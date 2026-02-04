/**
 * Two-Stage Prompt Refinement System
 * ===================================
 * 
 * CENTRAL PROMPT ARCHITECTURE:
 * This module is the single source of truth for provider-specific prompt optimization.
 * All prompt formatting decisions are centralized here.
 * 
 * DATA FLOW:
 * 1. generate-script: Creates base imagePrompts (semantic content, actions)
 * 2. generate-image/generate-video: Builds core prompt with context
 * 3. THIS MODULE: Refines for provider-specific optimal format
 * 4. Providers: Apply minimal additions (composition, physics only)
 * 
 * PROVIDER REQUIREMENTS (all handled here):
 * - DALL-E 3 / GPT Image Mini: Natural language, built-in rewriter handles anatomy
 * - SDXL: Style keywords at START, keyword-tag format, negative prompts generated
 * - Flux: Natural language, style at END, no negative prompts
 * - Wan 2.1: Subject + Scene + Motion + Camera + Atmosphere + Style formula
 * 
 * WHEN REFINEMENT IS DISABLED:
 * Providers fall back to their internal enhancement logic (less optimal but functional).
 * 
 * Enable/disable via PROMPT_REFINEMENT_ENABLED env (default: true)
 * Cost: ~$0.0007 per 5-scene video (negligible)
 */

import { openai } from '@/lib/openai-client';
import { withRetry } from '@/lib/retry';
import { withTimeout } from '@/lib/timeout';
import type { ImageProviderId } from '@/lib/providers/image-providers';
import type { VideoProviderId } from '@/lib/providers/video-providers';

export type ProviderId = ImageProviderId | VideoProviderId;

/** Whether prompt refinement is enabled (default true). */
export const PROMPT_REFINEMENT_ENABLED = process.env.PROMPT_REFINEMENT_ENABLED !== 'false';

/** Timeout for refinement calls (short since they're simple). */
const REFINEMENT_TIMEOUT_MS = 15_000;

/** Model used for prompt refinement (lightweight is fine). */
const REFINEMENT_MODEL = 'gpt-4o-mini';

/**
 * Provider-specific guidelines for prompt engineering.
 * Based on official documentation and best practices for each model.
 */
export const PROVIDER_GUIDELINES: Record<ProviderId, ProviderGuidelines> = {
  // === IMAGE PROVIDERS ===
  
  'dall-e-3': {
    name: 'DALL-E 3',
    type: 'image',
    stylePosition: 'anywhere',
    format: 'natural-language',
    maxLength: 4000,
    supportsNegativePrompt: false,
    anatomyHandling: 'built-in',
    guidelines: `DALL-E 3 has a built-in prompt rewriter that enhances prompts automatically.
Best practices:
- Use natural, descriptive language (not keyword stacking)
- Detailed descriptions work better than short ones
- No need for explicit anatomy instructions (handled internally)
- Focus on composition and the scene you want to see
- The model auto-expands prompts, so focus on CONTENT not formatting tricks`,
    exampleTransform: {
      before: 'worker pressing button, safety vest, warehouse',
      after: 'A worker wearing a bright orange safety vest presses a large red emergency stop button with their index finger. BACKGROUND: Industrial warehouse interior with tall metal storage shelving racks on both sides, concrete floor with yellow safety lines, fluorescent overhead lighting, cardboard boxes on pallets visible in the distance. The focus is on the decisive pressing motion.',
    },
  },

  'gpt-image-1-mini': {
    name: 'GPT Image 1 Mini',
    type: 'image',
    stylePosition: 'anywhere',
    format: 'natural-language',
    maxLength: 4000,
    supportsNegativePrompt: false,
    anatomyHandling: 'built-in',
    guidelines: `GPT Image 1 Mini is similar to DALL-E 3 with built-in prompt enhancement.
Best practices:
- Clear, detailed natural language descriptions
- Built-in prompt enhancement handles anatomy
- Good balance of quality and cost
- Focus on describing the scene AND environment clearly`,
    exampleTransform: {
      before: 'forklift operator checking mirrors',
      after: 'A forklift operator seated in the driver position turns their head to check the side mirror before reversing. They wear a yellow hard hat and safety vest. BACKGROUND: Large warehouse interior with organized metal storage racks stretching into the distance, polished concrete floor with forklift lane markings, industrial ceiling with exposed beams and bright overhead lights.',
    },
  },

  'sdxl': {
    name: 'Stability SDXL',
    type: 'image',
    stylePosition: 'start',
    format: 'keyword-tags',
    maxLength: 2000,
    supportsNegativePrompt: true,
    anatomyHandling: 'explicit-required',
    guidelines: `SDXL excels at artistic styles but struggles with complex multi-part prompts.
Best practices:
- Put STYLE KEYWORDS at the START (e.g., "digital art, photorealistic")
- Use keyword/tag format rather than sentences
- INCLUDE ENVIRONMENT KEYWORDS: warehouse shelving, concrete floor, industrial lighting, etc.
- Keep prompts focused and simple (not long structured prompts)
- Must explicitly mention anatomy quality (hands with five fingers, proper proportions)
- Negative prompt: exclude blurry, deformed, extra limbs - but DO NOT exclude people types mentioned in the prompt
- Format: Style prefix + Subject + Action + Environment/Background + Quality keywords`,
    exampleTransform: {
      before: 'A worker wearing safety gear pressing an emergency button in a warehouse',
      after: 'professional safety illustration, digital art, worker in orange safety vest and hard hat, pressing red emergency button, warehouse interior background, metal storage shelving, concrete floor, fluorescent lighting, industrial setting, proper human anatomy, hands with five fingers, clean composition',
    },
  },

  'flux': {
    name: 'Flux Dev',
    type: 'image',
    stylePosition: 'end',
    format: 'natural-language',
    maxLength: 2000,
    supportsNegativePrompt: false,
    anatomyHandling: 'explicit-helpful',
    guidelines: `Flux uses natural language prompting, NOT tag-heavy approaches.
Best practices:
- Subject + Action FIRST, then Environment, then Style (style at END)
- DESCRIBE THE BACKGROUND in detail: what's behind the person, floor type, lighting, surrounding equipment
- Descriptive sentences outperform keyword lists
- Natural language descriptions, not keyword stacking
- Explicitly mentioning anatomy quality is helpful (but natural language)
- No negative prompts (not supported)
- Comma separation for distinct concepts`,
    exampleTransform: {
      before: 'photorealistic, safety training, worker with hard hat pressing button',
      after: 'A warehouse worker wearing a yellow hard hat and bright safety vest reaches forward to press a red emergency stop button on a control panel. Their hand shows natural proportions with five fingers making contact with the button. BACKGROUND: Industrial warehouse with tall metal storage racks, concrete floor with yellow safety markings, fluorescent ceiling lights. Professional safety training photograph with clean lighting.',
    },
  },

  // === VIDEO PROVIDERS ===

  'wan': {
    name: 'Wan 2.1',
    type: 'video',
    stylePosition: 'end',
    format: 'structured',
    maxLength: 2000,
    supportsNegativePrompt: false,
    anatomyHandling: 'explicit-required',
    formula: 'Subject + Scene/Environment + Motion + Camera + Atmosphere + Style',
    guidelines: `Wan 2.1 is a text-to-video model that needs TEMPORAL descriptions.
Best practices:
- Follow the formula: Subject + Scene/Environment + Motion + Camera + Atmosphere + Style
- SCENE/ENVIRONMENT IS CRITICAL: describe the background setting in detail
- MOTION DESCRIPTIONS ARE CRITICAL (unlike image prompts)
- Describe HOW things move, not just what they look like
- Include camera language (static shot, slow pan, etc.)
- Slow, deliberate movements generate better than fast action
- Add physics grounding: "Objects obey gravity", "natural joint movement"
- Keep movements simple - one clear action per clip
- Static camera (tripod shot) works best for training content`,
    exampleTransform: {
      before: 'Worker pressing emergency button in warehouse',
      after: 'A worker in an orange safety vest stands at a control panel. ENVIRONMENT: Industrial warehouse with tall metal storage racks in background, concrete floor with yellow safety lines, fluorescent ceiling lights casting even illumination. Motion: their hand reaches forward and presses down on the red emergency button with a deliberate pressing motion. Static medium shot on tripod, professional training video framing. Industrial atmosphere. Clean digital illustration style. Human figure with natural proportions and joint movement.',
    },
  },

  'off': {
    name: 'Disabled',
    type: 'video',
    stylePosition: 'anywhere',
    format: 'natural-language',
    maxLength: 0,
    supportsNegativePrompt: false,
    anatomyHandling: 'built-in',
    guidelines: 'Video generation is disabled.',
    exampleTransform: { before: '', after: '' },
  },
};

export interface ProviderGuidelines {
  name: string;
  type: 'image' | 'video';
  stylePosition: 'start' | 'end' | 'anywhere';
  format: 'natural-language' | 'keyword-tags' | 'structured';
  maxLength: number;
  supportsNegativePrompt: boolean;
  anatomyHandling: 'built-in' | 'explicit-required' | 'explicit-helpful';
  formula?: string;
  guidelines: string;
  exampleTransform: {
    before: string;
    after: string;
  };
}

export interface RefinementParams {
  /** The base prompt (from script generation). */
  basePrompt: string;
  /** Original narration for context. */
  narration?: string;
  /** Style guide from the script. */
  styleGuide?: string;
  /** Target provider ID. */
  providerId: ProviderId;
}

export interface RefinementResult {
  /** The refined prompt optimized for the provider. */
  refinedPrompt: string;
  /** For providers that support it, a negative prompt. */
  negativePrompt?: string;
  /** Whether refinement was applied (false if disabled or provider not supported). */
  wasRefined: boolean;
}

/**
 * Build the system prompt for the refinement model.
 */
function buildRefinementSystemPrompt(guidelines: ProviderGuidelines): string {
  const isVideo = guidelines.type === 'video';
  const typeLabel = isVideo ? 'video' : 'image';
  
  let systemPrompt = `You are a prompt engineering specialist. Your task is to rewrite ${typeLabel} generation prompts to be optimally formatted for ${guidelines.name}.

## CRITICAL: Preserve Scene Context
You MUST preserve and emphasize the ENVIRONMENT/LOCATION/SETTING from the original prompt:
- If the prompt mentions "warehouse" - the background MUST show warehouse elements (shelving, pallets, industrial lighting)
- If the prompt mentions "construction site" - show construction environment (scaffolding, materials, equipment)
- If the prompt mentions "office" - show office setting (desks, computers, fluorescent lights)
- If the prompt mentions "kitchen" or "restaurant" - show commercial kitchen environment
- The background scene MUST match the context where the safety action takes place
- Include specific environmental details: floor type, lighting, surrounding equipment, walls/structures

## People in Scene
- INCLUDE other people when they are EXPLICITLY part of the safety scenario:
  - "pedestrians" = show pedestrians in the scene (e.g., forklift yielding to pedestrians)
  - "coworker", "spotter", "partner" = show the second person
  - "two-person lift" = show two people lifting together
- Only DEFAULT to single person when no other people are mentioned
- Do NOT filter out people types that are explicitly referenced in the prompt or narration

## Provider Guidelines
${guidelines.guidelines}

## Format Requirements
- Style position: ${guidelines.stylePosition === 'start' ? 'Style keywords should come FIRST' : guidelines.stylePosition === 'end' ? 'Style should come at the END' : 'Style can appear anywhere'}
- Format: ${guidelines.format === 'keyword-tags' ? 'Use keyword/tag format with commas' : guidelines.format === 'structured' ? 'Use structured sections' : 'Use natural descriptive language'}
- Max length: ${guidelines.maxLength} characters
- Anatomy: ${guidelines.anatomyHandling === 'built-in' ? 'No need for explicit anatomy instructions' : guidelines.anatomyHandling === 'explicit-required' ? 'MUST include explicit anatomy quality (hands with five fingers, proper proportions)' : 'Including anatomy quality phrases is helpful'}
- Environment: ALWAYS include the setting/location with specific background details`;

  if (guidelines.formula) {
    systemPrompt += `\n- Formula: ${guidelines.formula}`;
  }

  if (guidelines.supportsNegativePrompt) {
    systemPrompt += `\n\n## Negative Prompt
This provider supports negative prompts. Return a negative_prompt field with things to AVOID:
- blurry, distorted, deformed, extra limbs, extra fingers, fused fingers
- watermark, text, logo, duplicate figures
- IMPORTANT: Do NOT exclude people types that are explicitly mentioned in the prompt (e.g., if prompt mentions "pedestrians" or "coworker", do NOT put them in negative prompt)
- Only exclude UNWANTED people: random observers, audience, trainers watching from sidelines`;
  }

  systemPrompt += `

## Example Transformation
Before: "${guidelines.exampleTransform.before}"
After: "${guidelines.exampleTransform.after}"

## Output Format
Return ONLY valid JSON:
${guidelines.supportsNegativePrompt 
  ? '{ "refined_prompt": "your optimized prompt here", "negative_prompt": "things to avoid" }'
  : '{ "refined_prompt": "your optimized prompt here" }'
}`;

  return systemPrompt;
}

/**
 * Build the user prompt for refinement.
 */
function buildRefinementUserPrompt(params: RefinementParams): string {
  const { basePrompt, narration, styleGuide } = params;
  
  let userPrompt = `Rewrite this prompt for optimal results:

BASE PROMPT: ${basePrompt}`;

  if (narration) {
    userPrompt += `\n\nCONTEXT (narration): ${narration}`;
  }
  
  if (styleGuide) {
    userPrompt += `\n\nSTYLE GUIDE: ${styleGuide}`;
  }

  userPrompt += '\n\nReturn ONLY the JSON output, no explanation.';
  
  return userPrompt;
}

/**
 * Refine a prompt for a specific provider using OpenAI.
 * 
 * This calls GPT-4o-mini to rewrite the prompt following provider-specific
 * best practices for optimal generation quality.
 */
export async function refinePromptForProvider(
  params: RefinementParams
): Promise<RefinementResult> {
  const { providerId, basePrompt } = params;
  
  // If refinement is disabled or provider is 'off', return original
  if (!PROMPT_REFINEMENT_ENABLED || providerId === 'off') {
    return {
      refinedPrompt: basePrompt,
      wasRefined: false,
    };
  }

  const guidelines = PROVIDER_GUIDELINES[providerId];
  if (!guidelines || guidelines.maxLength === 0) {
    return {
      refinedPrompt: basePrompt,
      wasRefined: false,
    };
  }

  const systemPrompt = buildRefinementSystemPrompt(guidelines);
  const userPrompt = buildRefinementUserPrompt(params);

  try {
    const completion = await withTimeout(
      withRetry(() =>
        openai.chat.completions.create({
          model: REFINEMENT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3, // Lower temp for more consistent formatting
          max_tokens: 500,
        })
      ),
      REFINEMENT_TIMEOUT_MS,
      'Prompt refinement timed out'
    );

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[prompt-refinement] No content returned, using original prompt');
      return { refinedPrompt: basePrompt, wasRefined: false };
    }

    const parsed = JSON.parse(content) as { 
      refined_prompt?: string; 
      negative_prompt?: string;
    };

    if (!parsed.refined_prompt) {
      console.warn('[prompt-refinement] No refined_prompt in response, using original');
      return { refinedPrompt: basePrompt, wasRefined: false };
    }

    // Truncate to max length if needed
    let refinedPrompt = parsed.refined_prompt;
    if (refinedPrompt.length > guidelines.maxLength) {
      refinedPrompt = refinedPrompt.slice(0, guidelines.maxLength - 3) + '...';
    }

    console.log(`[prompt-refinement] Refined for ${providerId}: "${refinedPrompt.slice(0, 80)}..."`);

    return {
      refinedPrompt,
      negativePrompt: parsed.negative_prompt,
      wasRefined: true,
    };
  } catch (error) {
    // On any error, fall back to original prompt
    console.error('[prompt-refinement] Error during refinement, using original:', error);
    return {
      refinedPrompt: basePrompt,
      wasRefined: false,
    };
  }
}

/**
 * Get guidelines for a specific provider.
 * Useful for displaying to users or debugging.
 */
export function getProviderGuidelines(providerId: ProviderId): ProviderGuidelines | null {
  return PROVIDER_GUIDELINES[providerId] ?? null;
}

/**
 * Check if a provider benefits from prompt refinement.
 * OpenAI models (DALL-E 3, GPT Image Mini) have built-in rewriters,
 * so refinement provides less benefit (but can still help with structure).
 */
export function providerBenefitsFromRefinement(providerId: ProviderId): boolean {
  const guidelines = PROVIDER_GUIDELINES[providerId];
  if (!guidelines) return false;
  
  // Providers with explicit anatomy requirements benefit most
  return guidelines.anatomyHandling !== 'built-in';
}
