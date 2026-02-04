/**
 * Client-side helpers for video generation: audio duration, scene assets, and assemble.
 * Used by useVideoGeneration and the main page flow.
 */

import type { Scene, SceneAssets } from '@/lib/types';
import { fetchJson, fetchWithRetry, getApiError } from '@/lib/api-client';

export interface GenerateSceneAssetOptions {
  styleGuide: string;
  highQuality: boolean;
  voice: string;
  draft: boolean;
  captions: boolean;
  signal?: AbortSignal;
  /** When true, use Tier 3 video provider instead of image (call generate-video). */
  useVideo?: boolean;
  /** Key safety concepts to emphasize in images. */
  safetyKeywords?: string;
}

export interface ProviderConfig {
  videoProvider: 'wan' | 'off';
  imageProvider: string;
  ttsProvider: string;
}

let cachedConfig: ProviderConfig | null = null;

/** Fetches provider config (cached). Used for scene generation and cost estimation. */
export async function fetchProviderConfig(): Promise<ProviderConfig> {
  if (cachedConfig) return cachedConfig;
  const res = await fetch('/api/config');
  if (!res.ok) {
    cachedConfig = { videoProvider: 'off', imageProvider: 'dall-e-3', ttsProvider: 'openai' };
    return cachedConfig;
  }
  const data = await res.json();
  cachedConfig = {
    videoProvider: data.videoProvider === 'wan' ? 'wan' : 'off',
    imageProvider: data.imageProvider ?? 'dall-e-3',
    ttsProvider: data.ttsProvider ?? 'openai',
  };
  return cachedConfig;
}

/** Clear cached config (e.g. after env change in dev). */
export function clearProviderConfigCache(): void {
  cachedConfig = null;
}

/** Options for createVideo/regenerateScene; styleGuide is derived from script in the hook. */
export type VideoGenerationOptions = Omit<GenerateSceneAssetOptions, 'styleGuide'>;

/**
 * Returns duration in seconds for a base64 audio string.
 * contentType defaults to audio/mpeg; supports audio/wav, audio/webm, etc.
 */
export function getAudioDuration(
  audioBase64: string,
  contentType = 'audio/mpeg'
): Promise<number> {
  return new Promise((resolve, reject) => {
    const mime = contentType.startsWith('audio/') ? contentType : 'audio/mpeg';
    const audio = new Audio(`data:${mime};base64,${audioBase64}`);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
    audio.addEventListener('error', () => reject(new Error('Audio load failed')));
  });
}

/**
 * Fetches image or video + audio for one scene, returns a SceneAssets entry.
 * When options.useVideo is true, calls generate-video instead of generate-image.
 */
export async function generateSceneAsset(
  scene: Scene,
  sceneIndex: number,
  options: GenerateSceneAssetOptions
): Promise<SceneAssets> {
  const fetchOpts = options.signal ? { signal: options.signal } : undefined;
  const useVideo = !!options.useVideo;

  const [visualResult, audioResult] = await Promise.all([
    useVideo
      ? fetchJson<{ videoBase64: string; durationSeconds: number }>(
          '/api/generate-video',
          {
            prompt: scene.imagePrompt,
            styleGuide: options.styleGuide,
            sceneIndex,
            // Pass narration to help video provider infer appropriate motion
            narration: scene.narration,
          },
          fetchOpts
        )
      : fetchJson<{ imageBase64: string }>(
          '/api/generate-image',
          {
            imagePrompt: scene.imagePrompt,
            styleGuide: options.styleGuide,
            highQuality: options.highQuality,
            narration: scene.narration,
            sceneIndex,
            safetyKeywords: options.safetyKeywords,
          },
          fetchOpts
        ),
    fetchJson<{ audioBase64: string; contentType?: string }>(
      '/api/generate-audio',
      { text: scene.narration, voice: options.voice, draft: options.draft },
      fetchOpts
    ),
  ]);

  if (!visualResult.ok) throw new Error(visualResult.error.message);
  if (!audioResult.ok) throw new Error(audioResult.error.message);

  const audioDurationSeconds = await getAudioDuration(
    audioResult.data.audioBase64,
    audioResult.data.contentType
  );

  const durationSeconds = useVideo
    ? Math.max(
        (visualResult.data as { durationSeconds: number }).durationSeconds,
        audioDurationSeconds,
        3
      )
    : Math.max(audioDurationSeconds, 3);

  return useVideo
    ? {
        sceneIndex,
        videoBase64: (visualResult.data as { videoBase64: string }).videoBase64,
        audioBase64: audioResult.data.audioBase64,
        durationSeconds,
        narration: options.captions ? scene.narration : undefined,
      }
    : {
        sceneIndex,
        imageBase64: (visualResult.data as { imageBase64: string }).imageBase64,
        audioBase64: audioResult.data.audioBase64,
        durationSeconds,
        narration: options.captions ? scene.narration : undefined,
      };
}

/**
 * Calls assemble-video and returns the video blob. Throws on non-ok response.
 * Pass signal for AbortController support.
 */
export async function assembleVideo(
  scenes: SceneAssets[],
  captions: boolean,
  options?: { signal?: AbortSignal }
): Promise<Blob> {
  const res = await fetchWithRetry('/api/assemble-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenes, captions }),
    signal: options?.signal,
  });

  if (!res.ok) {
    const err = await getApiError(res);
    throw new Error(err.message);
  }

  return res.blob();
}
