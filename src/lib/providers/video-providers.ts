/**
 * Video generation provider abstraction.
 * Switch tiers via VIDEO_PROVIDER env: off | wan
 * 
 * PROMPT ARCHITECTURE:
 * Video prompts are optimized by the two-stage refinement system (see prompt-refinement.ts)
 * BEFORE reaching these providers. When refinement is enabled:
 * - Prompts arrive with temporal descriptions (motion, camera, atmosphere)
 * - The wasRefined flag indicates refinement was applied
 * - Providers add only physics grounding, skip internal transformation
 * 
 * When refinement is disabled (wasRefined=false), the buildVideoPrompt fallback
 * transforms image-oriented prompts into video-optimized prompts.
 */

import { withReplicateThrottle } from '@/lib/replicate-throttle';
import { withRetry } from '@/lib/retry';
import { withTimeout } from '@/lib/timeout';
export type VideoProviderId = 'off' | 'wan';

export interface VideoGenerateParams {
  prompt: string;
  styleGuide?: string;
  /** Target duration hint (seconds); providers may approximate. */
  durationSeconds?: number;
  /** Original narration text - helps infer appropriate motion. */
  narration?: string;
  /** If true, prompt was already refined by the refinement layer - skip internal buildVideoPrompt. */
  wasRefined?: boolean;
}

export interface VideoGenerateResult {
  videoBase64: string;
  durationSeconds: number;
}

export interface VideoProvider {
  id: VideoProviderId;
  generate(params: VideoGenerateParams): Promise<VideoGenerateResult>;
}

/** Extract URL from Replicate output. */
function getOutputUrl(out: unknown): string {
  if (typeof out === 'string') return out;
  if (out && typeof out === 'object') {
    const u = (out as { url?: () => URL }).url?.();
    if (u) return typeof u === 'string' ? u : (u as URL).href;
    if ((out as { href?: string }).href) return (out as { href: string }).href;
  }
  return '';
}

/**
 * FALLBACK: Extract motion cues from an image prompt and narration.
 * Used when prompt refinement is disabled. Returns motion description for video.
 */
function inferMotionFromPrompt(imagePrompt: string, narration?: string): string {
  const combined = `${imagePrompt} ${narration ?? ''}`.toLowerCase();
  
  // Action verbs that imply specific motions
  const motionPatterns: { pattern: RegExp; motion: string }[] = [
    { pattern: /\bpressing\b.*button/i, motion: 'finger presses down on the button with a deliberate motion' },
    { pattern: /\bpulling\b.*strap|seatbelt/i, motion: 'hands pull the strap across the chest in a smooth motion' },
    { pattern: /\bturned|turning|look.*left|look.*right/i, motion: 'head slowly turns to look in the indicated direction' },
    { pattern: /\bpointing\b/i, motion: 'arm extends to point at the object' },
    { pattern: /\bholding\b.*radio|walkie/i, motion: 'hand brings the radio up toward the mouth' },
    { pattern: /\bwalking|walks\b/i, motion: 'person walks forward with natural stride' },
    { pattern: /\bchecking|inspecting\b/i, motion: 'person leans in to examine the object closely' },
    { pattern: /\blifting|picks up\b/i, motion: 'person bends and lifts the object with proper form' },
    { pattern: /\bwearing|puts on\b/i, motion: 'person adjusts the equipment on their body' },
    { pattern: /\boperating|drives?\b/i, motion: 'hands grip controls and make small adjustments' },
    { pattern: /\bgripping|grabs?\b/i, motion: 'hand closes firmly around the object' },
    { pattern: /\breaching\b/i, motion: 'arm extends forward toward the target' },
  ];
  
  for (const { pattern, motion } of motionPatterns) {
    if (pattern.test(combined)) {
      return motion;
    }
  }
  
  // Default subtle motion for safety training scenes
  return 'subtle natural movements, person maintains steady focused posture';
}

/**
 * FALLBACK: Infer camera movement based on scene type.
 * Used when prompt refinement is disabled.
 */
function inferCameraMovement(imagePrompt: string): string {
  const prompt = imagePrompt.toLowerCase();
  
  if (prompt.includes('close-up') || prompt.includes('closeup')) {
    return 'Static close-up shot, no camera movement, sharp focus on hands and controls';
  }
  
  if (prompt.includes('wide') || prompt.includes('environment') || prompt.includes('warehouse')) {
    return 'Static wide shot establishing the environment, steady tripod composition';
  }
  
  // Default for safety training: stable, professional
  return 'Steady medium shot, static camera on tripod, professional training video framing';
}

/**
 * FALLBACK: Transform an image-oriented prompt into a video-optimized prompt.
 * Used when prompt refinement is disabled (wasRefined=false).
 * 
 * When refinement is enabled, this function is skipped - the refinement layer
 * already applies the Wan 2.1 formula: Subject + Scene + Motion + Camera + Atmosphere + Style
 */
function buildVideoPrompt(
  imagePrompt: string,
  styleGuide?: string,
  narration?: string
): string {
  const motion = inferMotionFromPrompt(imagePrompt, narration);
  const camera = inferCameraMovement(imagePrompt);
  
  // Extract subject and scene from image prompt (it's already descriptive)
  // The image prompt typically has: "[Character] in [location], [action description]"
  const subjectAndScene = imagePrompt;
  
  // Build video prompt following Wan 2.1 formula
  const parts: string[] = [];
  
  // Subject + Scene (from image prompt, but strip "single person scene" suffix if present)
  const cleanedPrompt = subjectAndScene
    .replace(/,?\s*single person scene,?\s*no other people\.?/gi, '')
    .trim();
  parts.push(cleanedPrompt);
  
  // Motion (inferred from action verbs)
  parts.push(`Motion: ${motion}`);
  
  // Camera
  parts.push(camera);
  
  // Atmosphere for safety training
  parts.push('Professional training video atmosphere, clear educational focus');
  
  // Style (if provided)
  if (styleGuide) {
    parts.push(`Visual style: ${styleGuide}`);
  }
  
  // Quality constraints for better video generation
  parts.push('Slow deliberate movements, consistent lighting, single focal subject');
  
  return parts.join('. ') + '.';
}

/**
 * Wan 2.1 T2V 480p via Replicate (~$0.07/sec, ~8s output).
 * 
 * When wasRefined=true: prompt already contains motion, camera, and temporal
 * descriptions from the refinement layer - just add physics grounding.
 * 
 * When wasRefined=false: uses buildVideoPrompt fallback to transform the
 * image-oriented prompt into video format.
 */
async function generateWan(params: VideoGenerateParams): Promise<VideoGenerateResult> {
  const { prompt, styleGuide, narration, wasRefined } = params;
  
  let fullPrompt: string;
  
  if (wasRefined) {
    // Prompt was already refined by the refinement layer with video-specific
    // temporal descriptions (motion, camera, atmosphere) - use directly
    // Just add physics layer for consistency
    const physicsLayer = [
      'Objects obey gravity and stay grounded.',
      'Human figure with natural proportions and joint movement.',
      'No flickering or sudden lighting changes.',
    ].join(' ');
    fullPrompt = `${prompt} ${physicsLayer}`.slice(0, 2000);
  } else {
    // Transform image-oriented prompt to video-optimized prompt
    // This adds motion, camera, and temporal descriptions
    const videoPrompt = buildVideoPrompt(prompt, styleGuide, narration);
    
    // Wan 2.1 benefits from detailed prompts - add physics/quality layer
    const physicsLayer = [
      'Objects obey gravity and stay grounded.',
      'Human figure with natural proportions and joint movement.',
      'No flickering or sudden lighting changes.',
    ].join(' ');
    
    fullPrompt = `${videoPrompt} ${physicsLayer}`.slice(0, 2000);
  }
  
  console.warn(`[video-provider] Wan 2.1 prompt (refined: ${wasRefined ?? false}): ${fullPrompt.slice(0, 200)}...`);
  
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) throw new Error('Video generation service is not configured. Please contact support.');

  const { default: Replicate } = await import('replicate');
  const replicate = new Replicate({ auth: token });

  // 128 frames at 16fps = 8 seconds (reduces looping for typical narration)
  const numFrames = 128;
  const fps = 16;

  const output = await withTimeout(
    withRetry(() =>
      withReplicateThrottle(() =>
        replicate.run('wavespeedai/wan-2.1-t2v-480p', {
          input: {
            prompt: fullPrompt,
            num_frames: numFrames,
            frames_per_second: fps,
            sample_steps: 30,
            // Motion control parameters for better physics:
            sample_guide_scale: 5.5, // 3-7 sweet spot; higher = more prompt adherence
            sample_shift: 3, // Lower (1-3) = smoother, more predictable motion
          },
        })
      )
    ),
    300_000, // 5 minutes - Wan can take a while with cold starts
    'Video generation timed out'
  );

  const out = Array.isArray(output) ? output[0] : output;
  const url = getOutputUrl(out);
  if (!url) throw new Error('No video generated');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const videoBase64 = buffer.toString('base64');

  const durationSeconds = numFrames / fps; // 128/16 = 8 seconds

  return { videoBase64, durationSeconds };
}

/** No-op provider when VIDEO_PROVIDER=off. */
const offProvider: VideoProvider = {
  id: 'off',
  generate: async () => {
    throw new Error('Video provider is disabled (VIDEO_PROVIDER=off)');
  },
};

const PROVIDERS: Record<VideoProviderId, VideoProvider> = {
  off: offProvider,
  wan: {
    id: 'wan',
    generate: generateWan,
  },
};

export function getVideoProviderId(): VideoProviderId {
  const id = (process.env.VIDEO_PROVIDER ?? 'off') as VideoProviderId;
  return PROVIDERS[id] ? id : 'off';
}

export function getVideoProvider(): VideoProvider {
  const id = getVideoProviderId();
  const provider = PROVIDERS[id];
  if (!provider || id === 'off') return PROVIDERS.off;
  return provider;
}

/** Returns true when video generation is enabled. */
export function isVideoProviderEnabled(): boolean {
  const id = process.env.VIDEO_PROVIDER ?? 'off';
  return id !== 'off' && !!PROVIDERS[id as VideoProviderId];
}
