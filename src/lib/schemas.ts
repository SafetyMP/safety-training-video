import { z } from 'zod';
import {
  MAX_PROMPT_LENGTH,
  MAX_TTS_TEXT_LENGTH,
  MAX_IMAGE_PROMPT_LENGTH,
  MAX_SCENES,
  VOICE_VALUES,
  VISUAL_STYLE_PRESET_VALUES,
} from './constants';

/** Format Zod errors for standardized API error response. */
export function formatValidationErrors(
  parseResult: { success: false; error: z.ZodError }
): { error: string; code: 'VALIDATION_ERROR'; details: { errors: Array<{ path: string; message: string }> } } {
  const errors = parseResult.error.errors.map((e) => ({
    path: e.path.join('.'),
    message: e.message,
  }));
  const first = errors[0];
  return {
    error: first ? first.message : 'Invalid request',
    code: 'VALIDATION_ERROR',
    details: { errors },
  };
}

const VALID_VOICES = VOICE_VALUES;

/** Request body for POST /api/generate-script */
export const generateScriptBodySchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(MAX_PROMPT_LENGTH, 'Prompt too long'),
  draft: z.boolean().optional(),
  audience: z.string().max(200).optional(),
  visualStylePreset: z.enum(VISUAL_STYLE_PRESET_VALUES).optional(),
  /** Key safety keywords/concepts that images should emphasize (comma-separated). */
  safetyKeywords: z.string().max(500).optional(),
});

/** Request body for POST /api/generate-image */
export const generateImageBodySchema = z.object({
  imagePrompt: z.string().min(1, 'imagePrompt is required').max(MAX_IMAGE_PROMPT_LENGTH, 'imagePrompt too long'),
  styleGuide: z.string().max(500).optional(),
  highQuality: z.boolean().optional(),
  narration: z.string().max(500).optional(),
  /** 0 = first scene (opening frame); used to lock style for the whole video. */
  sceneIndex: z.number().int().min(0).optional(),
  /** Key safety concepts to emphasize in the image. */
  safetyKeywords: z.string().max(500).optional(),
});

/** Request body for POST /api/generate-video */
export const generateVideoBodySchema = z.object({
  prompt: z.string().min(1, 'prompt is required').max(MAX_IMAGE_PROMPT_LENGTH, 'prompt too long'),
  styleGuide: z.string().max(500).optional(),
  sceneIndex: z.number().int().min(0).optional(),
  /** Original narration text - helps infer appropriate motion for video. */
  narration: z.string().max(1000).optional(),
});

/** Request body for POST /api/generate-audio */
export const generateAudioBodySchema = z.object({
  text: z.string().min(1, 'text is required').max(MAX_TTS_TEXT_LENGTH, 'text too long for TTS'),
  voice: z.enum(VALID_VOICES).optional().default('onyx'),
  draft: z.boolean().optional(),
});

/** Single scene in script result (from OpenAI) */
export const sceneSchema = z.object({
  narration: z.string().min(1),
  imagePrompt: z.string().min(1),
  // Model sometimes returns null instead of omitting the field
  duration: z.number().positive().nullish().transform(v => v ?? undefined),
});

/** Full script result from generate-script */
export const scriptResultSchema = z.object({
  title: z.string().min(1),
  visualStyle: z.string().optional(),
  scenes: z.array(sceneSchema).min(1).max(MAX_SCENES),
});

/** Single scene asset for assemble-video. Either imageBase64 or videoBase64 required. */
export const sceneAssetSchema = z
  .object({
    sceneIndex: z.number().int().min(0),
    imageBase64: z.string().min(1).optional(),
    videoBase64: z.string().min(1).optional(),
    audioBase64: z.string().min(1),
    durationSeconds: z.number().positive(),
    narration: z.string().optional(),
  })
  .refine((d) => !!(d.imageBase64 || d.videoBase64), {
    message: 'Either imageBase64 or videoBase64 is required',
  })
  .refine((d) => !(d.imageBase64 && d.videoBase64), {
    message: 'Cannot have both imageBase64 and videoBase64',
  });

/** Request body for POST /api/assemble-video */
export const assembleVideoBodySchema = z.object({
  scenes: z.array(sceneAssetSchema).min(1).max(MAX_SCENES),
  captions: z.boolean().optional().default(true),
});

export type GenerateScriptBody = z.infer<typeof generateScriptBodySchema>;
export type GenerateImageBody = z.infer<typeof generateImageBodySchema>;
export type GenerateVideoBody = z.infer<typeof generateVideoBodySchema>;
export type GenerateAudioBody = z.infer<typeof generateAudioBodySchema>;
export type ScriptResultValidated = z.infer<typeof scriptResultSchema>;
export type AssembleVideoBody = z.infer<typeof assembleVideoBodySchema>;
