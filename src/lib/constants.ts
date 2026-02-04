/**
 * Centralized constants for the Safety Training Video app.
 * 
 * Includes:
 * - API limits and timeouts
 * - Rate limiting configuration
 * - Video generation parameters
 * - Voice options (18 voices in 5 categories with subject-matter recommendations)
 * - Visual style presets
 * - Cost estimates for all providers (DALL-E 3, GPT Image Mini, SDXL, Flux Dev, OpenAI TTS, Edge, Kokoro)
 * - Provider configuration
 */

/** Max characters for the user prompt (generate-script). */
export const MAX_PROMPT_LENGTH = 4000;

/** Max completion tokens for script generation (3–6 scenes JSON; caps cost). */
export const SCRIPT_MAX_TOKENS = 2048;

/** Max characters for TTS text (generate-audio). OpenAI TTS limit is 4096. */
export const MAX_TTS_TEXT_LENGTH = 4096;

/** Max characters for image prompt building (style + narration + imagePrompt). */
export const MAX_IMAGE_PROMPT_LENGTH = 4000;

/** Max scenes in a single video (assemble-video). */
export const MAX_SCENES = 10;

/** Max request body size for assemble-video (base64 blobs). 50 MB (Tier 3 video clips are larger). */
export const MAX_ASSEMBLE_BODY_BYTES = 50 * 1024 * 1024;

/** Request timeout for OpenAI calls (ms). */
export const OPENAI_REQUEST_TIMEOUT_MS = 90_000;

/** Request timeout for FFmpeg assemble (ms). */
export const ASSEMBLE_VIDEO_TIMEOUT_MS = 300_000;

/** Rate limit: max requests per window for expensive API routes. */
export const RATE_LIMIT_REQUESTS = 30;

/** Rate limit window in ms (e.g. 30 requests per minute). */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Min scene duration in seconds (assemble-video). */
export const MIN_SCENE_DURATION = 3;

/** Fade duration in seconds. */
export const FADE_DURATION = 0.3;

/** Output video dimensions. */
export const OUTPUT_WIDTH = 1920;
export const OUTPUT_HEIGHT = 1080;

/** Video bitrate. */
export const VIDEO_BITRATE = '2M';

/** Max caption length for burn-in text (chars). */
export const MAX_CAPTION_LENGTH = 120;

/** ETA: approximate seconds per scene (script + image + audio). Used for progress display. */
export const ETA_SECONDS_PER_SCENE = 28;

/** ETA: approximate seconds for final video assembly. Used for progress display. */
export const ETA_ASSEMBLY_SECONDS = 15;

/** Max concurrent scene asset generations (image + audio). Reduces total time vs sequential. */
export const SCENE_ASSET_CONCURRENCY = 3;

/** Min ms between Replicate API calls (6/min = 10s). Override with REPLICATE_THROTTLE_MS. */
export const REPLICATE_THROTTLE_MS = Number(process.env.REPLICATE_THROTTLE_MS) || 10_000;

/** OpenAI model for script generation. Override with OPENAI_SCRIPT_MODEL env. */
export const OPENAI_SCRIPT_MODEL = process.env.OPENAI_SCRIPT_MODEL ?? 'gpt-4o-mini';

/** OpenAI model for image generation. Override with OPENAI_IMAGE_MODEL env. */
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'dall-e-3';

/** Image provider: dall-e-3 | gpt-image-1-mini. Tier 1 = gpt-image-1-mini (50–70% cheaper). */
export const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER ?? 'dall-e-3';

/** TTS provider: openai | edge. Tier 1 = edge (free). */
export const TTS_PROVIDER = process.env.TTS_PROVIDER ?? 'openai';

// --- UI options (shared with schemas where applicable) ---

export const VOICE_VALUES = [
  // OpenAI native voices
  'onyx', 'alloy', 'echo', 'fable', 'nova', 'shimmer',
  // Extended voices (Edge TTS / Kokoro)
  'guy', 'jenny', 'aria', 'davis', 'jane', 'jason', 'sara', 'tony', 'nancy', 'andrew', 'emma', 'brian',
] as const;

export type VoiceCategory = 'authoritative' | 'friendly' | 'professional' | 'warm' | 'energetic';

export interface VoiceOption {
  value: (typeof VOICE_VALUES)[number];
  label: string;
  category: VoiceCategory;
  gender: 'male' | 'female';
  /** Safety topics this voice works well for */
  recommendedFor?: string[];
}

export const VOICES: ReadonlyArray<VoiceOption> = [
  // Authoritative voices - good for serious safety topics
  { value: 'onyx', label: 'Onyx (authoritative male)', category: 'authoritative', gender: 'male', recommendedFor: ['lockout-tagout', 'confined-space', 'fall-protection', 'electrical'] },
  { value: 'guy', label: 'Guy (authoritative male)', category: 'authoritative', gender: 'male', recommendedFor: ['machine-guarding', 'crane-rigging', 'excavation'] },
  { value: 'davis', label: 'Davis (authoritative male)', category: 'authoritative', gender: 'male', recommendedFor: ['emergency', 'fire-evacuation', 'hazmat'] },
  
  // Professional voices - good for corporate/compliance training
  { value: 'alloy', label: 'Alloy (professional neutral)', category: 'professional', gender: 'female', recommendedFor: ['hazard-communication', 'ppe', 'ergonomics'] },
  { value: 'jenny', label: 'Jenny (professional female)', category: 'professional', gender: 'female', recommendedFor: ['bloodborne-pathogens', 'respiratory-protection', 'hearing-conservation'] },
  { value: 'jason', label: 'Jason (professional male)', category: 'professional', gender: 'male', recommendedFor: ['forklift', 'scaffolding', 'hand-power-tools'] },
  
  // Friendly voices - good for general safety awareness
  { value: 'nova', label: 'Nova (friendly female)', category: 'friendly', gender: 'female', recommendedFor: ['slip-trip-fall', 'ppe', 'heat-stress'] },
  { value: 'jane', label: 'Jane (friendly female)', category: 'friendly', gender: 'female', recommendedFor: ['ergonomics', 'first-aid', 'general-safety'] },
  { value: 'tony', label: 'Tony (friendly male)', category: 'friendly', gender: 'male', recommendedFor: ['forklift', 'warehouse', 'material-handling'] },
  
  // Warm voices - good for sensitive topics
  { value: 'echo', label: 'Echo (warm male)', category: 'warm', gender: 'male', recommendedFor: ['first-aid', 'emergency-response', 'mental-health'] },
  { value: 'sara', label: 'Sara (warm female)', category: 'warm', gender: 'female', recommendedFor: ['bloodborne-pathogens', 'healthcare', 'stress-management'] },
  { value: 'nancy', label: 'Nancy (warm female)', category: 'warm', gender: 'female', recommendedFor: ['office-safety', 'ergonomics', 'wellness'] },
  
  // Clear/energetic voices - good for engaging content
  { value: 'shimmer', label: 'Shimmer (clear female)', category: 'energetic', gender: 'female', recommendedFor: ['new-hire-orientation', 'refresher', 'quick-tips'] },
  { value: 'aria', label: 'Aria (energetic female)', category: 'energetic', gender: 'female', recommendedFor: ['team-safety', 'safety-culture', 'engagement'] },
  { value: 'fable', label: 'Fable (expressive)', category: 'energetic', gender: 'female', recommendedFor: ['storytelling', 'case-studies', 'lessons-learned'] },
  { value: 'andrew', label: 'Andrew (energetic male)', category: 'energetic', gender: 'male', recommendedFor: ['construction', 'outdoor-work', 'active-jobs'] },
  
  // Additional professional voices
  { value: 'emma', label: 'Emma (British professional)', category: 'professional', gender: 'female', recommendedFor: ['international', 'corporate', 'executive'] },
  { value: 'brian', label: 'Brian (British professional)', category: 'professional', gender: 'male', recommendedFor: ['international', 'corporate', 'technical'] },
];

/** Get recommended voice based on safety topic keywords */
export function getRecommendedVoice(topicKeywords: string): VoiceOption | null {
  const keywords = topicKeywords.toLowerCase();
  
  // Find voices that match the topic
  const matches = VOICES.filter(v => 
    v.recommendedFor?.some(topic => keywords.includes(topic.replace(/-/g, ' ')) || keywords.includes(topic))
  );
  
  if (matches.length > 0) {
    return matches[0];
  }
  
  // Default recommendations based on general keywords
  if (keywords.includes('emergency') || keywords.includes('danger') || keywords.includes('critical')) {
    return VOICES.find(v => v.value === 'onyx') ?? null;
  }
  if (keywords.includes('new hire') || keywords.includes('orientation') || keywords.includes('welcome')) {
    return VOICES.find(v => v.value === 'nova') ?? null;
  }
  if (keywords.includes('compliance') || keywords.includes('regulation') || keywords.includes('osha')) {
    return VOICES.find(v => v.value === 'alloy') ?? null;
  }
  
  return null;
}

export const AUDIENCES = [
  { value: '', label: 'All' },
  { value: 'new hires', label: 'New hires' },
  { value: 'refresher', label: 'Refresher' },
] as const;

// --- Visual style presets (illustration is default for best narration match) ---

export const VISUAL_STYLE_PRESET_VALUES = [
  'illustration',
  'realistic',
  'semi-realistic',
  'stylized-3d',
] as const;

export type VisualStylePreset = (typeof VISUAL_STYLE_PRESET_VALUES)[number];

export const VISUAL_STYLE_PRESETS: ReadonlyArray<{
  value: VisualStylePreset;
  label: string;
  /** Short instruction passed to the script model (not shown to user). */
  scriptHint: string;
}> = [
  {
    value: 'illustration',
    label: 'Professional illustration (default)',
    scriptHint:
      'Professional corporate illustration style, realistic human proportions, clean composition, natural poses, accurate workplace equipment and environments. Characters should look like real people with proper anatomy.',
  },
  {
    value: 'realistic',
    label: 'Photorealistic',
    scriptHint:
      'Photorealistic stock photo style, natural lighting, realistic materials, authentic workplace environments, real human proportions and expressions.',
  },
  {
    value: 'semi-realistic',
    label: 'Semi-realistic illustration',
    scriptHint:
      'Semi-realistic digital illustration, accurate human proportions, soft shading, professional look, realistic workplace settings.',
  },
  {
    value: 'stylized-3d',
    label: 'Stylized 3D animation',
    scriptHint:
      'Stylized 3D animation render, proper human proportions, clean lighting, consistent character models across scenes.',
  },
] as const;

/** Estimated cost per script generation (gpt-4o-mini, ~2k tokens). */
export const EST_COST_SCRIPT = 0.002;

/** Estimated cost per image by provider. */
export const EST_COST_IMAGE: Record<string, { standard: number; hd: number }> = {
  'dall-e-3': { standard: 0.04, hd: 0.08 },
  'gpt-image-1-mini': { standard: 0.011, hd: 0.036 },
  sdxl: { standard: 0.001, hd: 0.002 }, // Replicate SDXL
  flux: { standard: 0.025, hd: 0.025 }, // Replicate Flux Dev (~$0.025/image)
};

/** Estimated cost per 1k characters TTS by provider. */
export const EST_COST_TTS_PER_1K: Record<string, { standard: number; draft: number }> = {
  openai: { standard: 0.03, draft: 0.015 },
  edge: { standard: 0, draft: 0 }, // free
  kokoro: { standard: 0, draft: 0 }, // Replicate ~$0.00022/run (negligible per 1k chars)
};

/** Video provider: off | wan. Tier 3 = wan (AI video clips via Replicate). */
export const VIDEO_PROVIDER = process.env.VIDEO_PROVIDER ?? 'off';

/** Estimated cost per video clip by provider (per scene). */
export const EST_COST_VIDEO: Record<string, number> = {
  wan: 0.56, // Replicate Wan 2.1 T2V: $0.07/sec × 8 sec = $0.56/clip
};

/** Cost lookup helpers (client may not have env; uses NEXT_PUBLIC_ or defaults). */
export const CLIENT_IMAGE_PROVIDER = process.env.NEXT_PUBLIC_IMAGE_PROVIDER ?? IMAGE_PROVIDER;
export const CLIENT_TTS_PROVIDER = process.env.NEXT_PUBLIC_TTS_PROVIDER ?? TTS_PROVIDER;
export const CLIENT_VIDEO_PROVIDER = process.env.NEXT_PUBLIC_VIDEO_PROVIDER ?? VIDEO_PROVIDER;

/** Session cost warning threshold (warn user). */
export const SESSION_COST_WARN = 0.25;

/** Session cost block threshold (block further API calls). */
export const SESSION_COST_BLOCK = 0.5;

export const TEMPLATES = [
  { label: 'Forklift safety', prompt: 'A safety training video about forklift safety in a warehouse: checking the horn, looking both ways, and slowing down near pedestrians.' },
  { label: 'Slip and trip hazards', prompt: 'A safety training video about slip and trip hazards: keeping walkways clear, cleaning spills, and wearing proper footwear.' },
  { label: 'PPE basics', prompt: 'A safety training video about PPE basics: when to wear hard hat, safety glasses, and high-vis vest, and why it matters.' },
  { label: 'Fire evacuation', prompt: 'A safety training video about fire evacuation: knowing exits, not using elevators, and meeting at the assembly point.' },
] as const;
