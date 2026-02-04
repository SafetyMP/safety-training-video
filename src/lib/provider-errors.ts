/**
 * User-friendly error messages for provider failures.
 * Avoids leaking implementation details (API keys, env vars) to end users.
 */

export const PROVIDER_ERRORS = {
  IMAGE_NOT_CONFIGURED: 'Image generation service is not configured. Please contact support.',
  AUDIO_NOT_CONFIGURED: 'Audio generation service is not configured. Please contact support.',
  VIDEO_NOT_CONFIGURED: 'Video generation service is not configured. Please contact support.',
  IMAGE_FAILED: 'Unable to generate image. Please try again.',
  AUDIO_FAILED: 'Unable to generate audio. Please try again.',
  VIDEO_FAILED: 'Unable to generate video. Please try again.',
  TIMEOUT: 'Request timed out. Please try again.',
} as const;

export function wrapProviderError(
  err: unknown,
  type: 'image' | 'audio' | 'video',
  configCheck = false
): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (configCheck && (msg.includes('required for') || msg.includes('REPLICATE_API_TOKEN') || msg.includes('OPENAI'))) {
    const key = type === 'image' ? 'IMAGE_NOT_CONFIGURED' : type === 'audio' ? 'AUDIO_NOT_CONFIGURED' : 'VIDEO_NOT_CONFIGURED';
    return new Error(PROVIDER_ERRORS[key]);
  }
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return new Error(PROVIDER_ERRORS.TIMEOUT);
  }
  const failKey = type === 'image' ? 'IMAGE_FAILED' : type === 'audio' ? 'AUDIO_FAILED' : 'VIDEO_FAILED';
  return new Error(PROVIDER_ERRORS[failKey]);
}
