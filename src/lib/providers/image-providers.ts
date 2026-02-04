/**
 * Image generation provider abstraction.
 * Switch tiers via IMAGE_PROVIDER env: dall-e-3 | gpt-image-1-mini | sdxl | flux
 * 
 * PROMPT ARCHITECTURE:
 * Prompts are optimized by the two-stage refinement system (see prompt-refinement.ts)
 * BEFORE reaching these providers. When refinement is enabled:
 * - Prompts arrive already formatted for each provider's optimal structure
 * - Providers should use the prompt as-is (minimal additional enhancement)
 * - SDXL receives a negativePrompt from refinement
 * 
 * When refinement is disabled, providers apply fallback enhancement logic.
 * 
 * Provider comparison:
 * - dall-e-3:         OpenAI, highest quality, $0.04-0.08/image
 * - gpt-image-1-mini: OpenAI, good balance, $0.01-0.04/image
 * - sdxl:             Replicate Stability AI, $0.001-0.002/image, 25-50 inference steps
 * - flux:             Replicate Flux Dev, $0.025/image, up to 50 steps, best Replicate quality
 * 
 * For safety training with human subjects, flux or dall-e-3 are recommended.
 */

import { OPENAI_REQUEST_TIMEOUT_MS } from '@/lib/constants';
import { openai } from '@/lib/openai-client';
import { withReplicateThrottle } from '@/lib/replicate-throttle';
import { withRetry } from '@/lib/retry';
import { withTimeout } from '@/lib/timeout';

export type ImageProviderId = 'dall-e-3' | 'gpt-image-1-mini' | 'sdxl' | 'flux';

export interface ImageGenerateParams {
  /** The core prompt with scene description and action emphasis. */
  prompt: string;
  highQuality: boolean;
  styleGuide?: string;
  /** Original scene description (before any enhancement). Used by some providers. */
  rawSceneDescription?: string;
  /** Negative prompt for providers that support it (e.g., SDXL). From refinement. */
  negativePrompt?: string;
}

export interface ImageProvider {
  id: ImageProviderId;
  generate(params: ImageGenerateParams): Promise<string>;
}

/**
 * DALL-E 3: higher quality, higher cost (~$0.04–0.08/image)
 * 
 * DALL-E 3 has a built-in prompt rewriter. When refinement is enabled,
 * prompts arrive already optimized - just pass through with minimal additions.
 */
async function generateDallE3(params: ImageGenerateParams): Promise<string> {
  const { prompt, highQuality, styleGuide } = params;
  const quality = styleGuide ? 'hd' : highQuality ? 'hd' : 'standard';
  const size = '1792x1024';

  // Prompt is already refined - just add basic composition reminder
  // (DALL-E's built-in rewriter will handle the rest)
  // Only add "single person" if the prompt doesn't mention other people
  const mentionsOtherPeople = /pedestrian|coworker|spotter|partner|two.?person|helper|assistant|team/i.test(prompt);
  const finalPrompt = mentionsOtherPeople 
    ? prompt 
    : `${prompt}\n\nSingle person in frame unless otherwise specified.`;

  const response = await withTimeout(
    withRetry(() =>
      openai.images.generate({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size,
        quality: quality as 'standard' | 'hd',
        response_format: 'b64_json',
      })
    ),
    OPENAI_REQUEST_TIMEOUT_MS,
    'Image generation timed out'
  );

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image generated');
  return typeof b64 === 'string' ? b64 : Buffer.from(b64).toString('base64');
}

/**
 * GPT Image 1 Mini: cost-efficient (~$0.005–0.036/image)
 * 
 * Similar to DALL-E 3 with built-in prompt enhancement.
 * Prompts arrive already refined - pass through with minimal additions.
 */
async function generateGptImageMini(params: ImageGenerateParams): Promise<string> {
  const { prompt, highQuality, styleGuide } = params;
  // gpt-image-1-mini: quality low|medium|high, sizes: 1024x1024, 1024x1536, 1536x1024
  const quality = styleGuide || highQuality ? 'high' : 'medium';
  const size = '1536x1024'; // closest to 1792x1024 aspect for video frames

  // Prompt is already refined - just add basic composition reminder
  // Only add "single person" if the prompt doesn't mention other people
  const mentionsOtherPeople = /pedestrian|coworker|spotter|partner|two.?person|helper|assistant|team/i.test(prompt);
  const finalPrompt = mentionsOtherPeople 
    ? prompt 
    : `${prompt}\n\nSingle person in frame unless otherwise specified.`;

  const response = await withTimeout(
    withRetry(() =>
      openai.images.generate({
        model: 'gpt-image-1-mini',
        prompt: finalPrompt,
        n: 1,
        size: size as '1024x1024' | '1024x1536' | '1536x1024',
        quality: quality as 'low' | 'medium' | 'high',
        response_format: 'b64_json',
      })
    ),
    OPENAI_REQUEST_TIMEOUT_MS,
    'Image generation timed out'
  );

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image generated');
  return typeof b64 === 'string' ? b64 : Buffer.from(b64).toString('base64');
}

/** Extract URL string from Replicate output (FileOutput, URL, or string). */
function getOutputUrl(out: unknown): string {
  if (typeof out === 'string') return out;
  if (out && typeof out === 'object') {
    const u = (out as { url?: () => URL; href?: string }).url?.();
    if (u) return typeof u === 'string' ? u : (u as URL).href;
    if ((out as { href?: string }).href) return (out as { href: string }).href;
  }
  return '';
}

/** Fetch URL and return base64. */
async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.toString('base64');
}

/** 
 * SDXL via Replicate (~$0.001–0.002/image)
 * 
 * When refinement is enabled: prompt arrives with style at START, keyword format,
 * and a negativePrompt is provided. When disabled: applies fallback formatting.
 */
async function generateSdxl(params: ImageGenerateParams): Promise<string> {
  const { highQuality, styleGuide, rawSceneDescription, prompt, negativePrompt: refinedNegativePrompt } = params;
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) throw new Error('Image generation service is not configured. Please contact support.');

  const { default: Replicate } = await import('replicate');
  const replicate = new Replicate({ auth: token });

  // Check if prompt was refined (indicated by presence of negativePrompt from refinement)
  const wasRefined = refinedNegativePrompt !== undefined;
  
  let finalPrompt: string;
  if (wasRefined) {
    // Prompt already optimized by refinement layer - use directly
    finalPrompt = prompt;
  } else {
    // FALLBACK: Apply SDXL-specific formatting when refinement is disabled
    // SDXL needs: Style at START, keyword format, anatomy instructions
    const sceneDescription = rawSceneDescription || prompt;
    const stylePrefix = styleGuide 
      ? `${styleGuide}, ` 
      : 'Professional safety training illustration, clean digital art style, ';
    finalPrompt = `${stylePrefix}${sceneDescription}, proper human anatomy with correct proportions, hands with five fingers, clear focal point, professional quality`;
  }

  // Use refined negative prompt if provided, otherwise build context-aware default
  // Don't exclude people types that are explicitly part of the scene
  let negativePrompt: string;
  if (refinedNegativePrompt) {
    negativePrompt = refinedNegativePrompt;
  } else {
    // Check if prompt mentions specific people types that should be included
    const mentionsPedestrians = /pedestrian/i.test(prompt);
    const mentionsCoworkers = /coworker|spotter|partner|helper|assistant|team/i.test(prompt);
    
    // Build negative prompt excluding only unwanted elements
    const excludeList = [
      'blurry', 'distorted', 'deformed', 'extra limbs', 'extra fingers', 
      'fused fingers', 'bad anatomy', 'watermark', 'text', 'logo', 
      'duplicate figures', 'ghost images'
    ];
    
    // Only exclude people types not mentioned in prompt
    if (!mentionsPedestrians && !mentionsCoworkers) {
      excludeList.push('crowd', 'group of people', 'bystanders', 'people watching', 'observers', 'audience');
    }
    if (!mentionsPedestrians) {
      // Don't add pedestrians to negative if they're supposed to be in scene
    } else {
      // Pedestrians are wanted - don't exclude them
    }
    
    negativePrompt = excludeList.join(', ');
  }

  const output = await withTimeout(
    withRetry(() =>
      withReplicateThrottle(() =>
        replicate.run('stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc', {
          input: {
            prompt: finalPrompt,
            negative_prompt: negativePrompt,
            width: 1024,
            height: 1024,
            num_inference_steps: highQuality ? 50 : 25,
            scheduler: 'K_EULER',
            guidance_scale: 7.5,
          },
        })
      )
    ),
    OPENAI_REQUEST_TIMEOUT_MS,
    'Image generation timed out'
  );

  const out = Array.isArray(output) ? output[0] : output;
  const url = getOutputUrl(out);
  if (!url) throw new Error('No image generated');
  return urlToBase64(url);
}

/** 
 * Flux Dev via Replicate (~$0.025/image) - higher quality than Schnell
 * 
 * When refinement is enabled: prompt arrives with natural language format,
 * style at END, anatomy instructions included. When disabled: applies fallback.
 * Flux does not support negative prompts.
 */
async function generateFlux(params: ImageGenerateParams): Promise<string> {
  const { prompt, highQuality, styleGuide, rawSceneDescription, negativePrompt: _negativePrompt } = params;
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) throw new Error('Image generation service is not configured. Please contact support.');

  const { default: Replicate } = await import('replicate');
  const replicate = new Replicate({ auth: token });

  // Check if prompt was refined (Flux doesn't use negativePrompt, but presence indicates refinement ran)
  // For Flux we check if prompt looks already refined (contains style language patterns)
  const looksRefined = prompt.length > 200 && /professional|illustration|photograph|style/i.test(prompt);
  
  let finalPrompt: string;
  if (looksRefined) {
    // Prompt already optimized by refinement layer - use directly
    finalPrompt = prompt;
  } else {
    // FALLBACK: Apply Flux-specific formatting when refinement is disabled
    // Flux needs: Subject + Action first, Style at END, natural language
    const sceneContent = rawSceneDescription || prompt;
    const styleSection = styleGuide 
      ? `Rendered in the style of ${styleGuide}.` 
      : 'Professional safety training illustration.';
    // Only add "single person" if no other people are mentioned in the scene
    const mentionsOtherPeople = /pedestrian|coworker|spotter|partner|two.?person|helper|assistant|team/i.test(sceneContent);
    const peopleClause = mentionsOtherPeople 
      ? 'People with anatomically correct proportions and natural poses, hands with five fingers'
      : 'Single person with anatomically correct proportions and natural pose, hands with five fingers';
    finalPrompt = `${sceneContent}. ${peopleClause}, clean composition with the main action as the clear focal point. ${styleSection} Professional quality with consistent lighting, no duplicate figures.`;
  }

  const output = await withTimeout(
    withRetry(() =>
      withReplicateThrottle(() =>
        replicate.run('black-forest-labs/flux-dev', {
          input: {
            prompt: finalPrompt,
            num_outputs: 1,
            aspect_ratio: '16:9',
            output_format: 'png',
            output_quality: 100,
            num_inference_steps: highQuality ? 50 : 28,
            guidance: highQuality ? 3.0 : 2.5, // Official default is 2.5
            go_fast: false,
          },
        })
      )
    ),
    120_000, // Flux Dev takes longer - 2 minute timeout
    'Image generation timed out'
  );

  const out = Array.isArray(output) ? output[0] : output;
  const url = getOutputUrl(out);
  if (!url) throw new Error('No image generated');
  return urlToBase64(url);
}

const PROVIDERS: Record<ImageProviderId, ImageProvider> = {
  'dall-e-3': {
    id: 'dall-e-3',
    generate: generateDallE3,
  },
  'gpt-image-1-mini': {
    id: 'gpt-image-1-mini',
    generate: generateGptImageMini,
  },
  sdxl: {
    id: 'sdxl',
    generate: generateSdxl,
  },
  flux: {
    id: 'flux',
    generate: generateFlux,
  },
};

export function getImageProviderId(): ImageProviderId {
  const id = (process.env.IMAGE_PROVIDER ?? process.env.NEXT_PUBLIC_IMAGE_PROVIDER ?? 'dall-e-3') as ImageProviderId;
  return PROVIDERS[id] ? id : 'dall-e-3';
}

export function getImageProvider(): ImageProvider {
  const id = getImageProviderId();
  return PROVIDERS[id];
}

/**
 * Check if current provider is an OpenAI image model.
 * Useful for cost estimation and feature detection.
 * Note: With the refinement system, all providers receive optimized prompts.
 */
export function isOpenAIImageProvider(): boolean {
  const id = getImageProviderId();
  return id === 'dall-e-3' || id === 'gpt-image-1-mini';
}
