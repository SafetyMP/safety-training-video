'use client';

import { useState, useCallback, useRef } from 'react';
import type { Scene, SceneAssets } from '@/lib/types';
import {
  ETA_SECONDS_PER_SCENE,
  ETA_ASSEMBLY_SECONDS,
  SCENE_ASSET_CONCURRENCY,
} from '@/lib/constants';
import {
  generateSceneAsset,
  assembleVideo,
  fetchProviderConfig,
  type VideoGenerationOptions,
  type GenerateSceneAssetOptions,
} from '@/lib/video-generation-client';
import { useCostContext, estimateSceneCost } from '@/app/contexts/CostContext';

export interface VideoProgress {
  current: number;
  total: number;
  phase: string;
  etaSeconds: number;
}

/** Run tasks with bounded concurrency. Results are in original order. */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());
  await Promise.all(workers);
  return results;
}

export function useVideoGeneration() {
  const { addCost, canProceed } = useCostContext();
  const [progress, setProgress] = useState<VideoProgress>({
    current: 0,
    total: 0,
    phase: '',
    etaSeconds: 0,
  });
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [assets, setAssets] = useState<SceneAssets[] | null>(null);
  const [regeneratingSceneIndex, setRegeneratingSceneIndex] = useState<number | null>(null);
  const videoResultRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const regenerateAbortRef = useRef<AbortController | null>(null);

  const focusVideoResult = useCallback(() => {
    videoResultRef.current?.focus({ preventScroll: true });
  }, []);

  const cancelVideoGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const cancelRegenerateScene = useCallback(() => {
    if (regenerateAbortRef.current) {
      regenerateAbortRef.current.abort();
    }
  }, []);

  const createVideo = useCallback(
    async (
      scenes: Scene[],
      scriptTitle: string,
      visualStyle: string | undefined,
      options: VideoGenerationOptions
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (!canProceed()) {
        return { ok: false, message: 'Session cost limit reached. Start over to reset.' };
      }
      const total = scenes.length;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const signal = controller.signal;

      const config = await fetchProviderConfig();
      const useVideo = config.videoProvider === 'wan';

      const opts: GenerateSceneAssetOptions = {
        ...options,
        styleGuide: visualStyle ?? scriptTitle,
        signal,
        useVideo,
      };

      try {
        let completed = 0;
        const onSceneComplete = () => {
          completed += 1;
          const eta =
            (total - completed) * Math.ceil(ETA_SECONDS_PER_SCENE / SCENE_ASSET_CONCURRENCY) +
            ETA_ASSEMBLY_SECONDS;
          const visualLabel = useVideo ? 'video' : 'image';
          setProgress({
            current: completed,
            total,
            phase: `Scene ${completed}/${total}: ${visualLabel} & audio`,
            etaSeconds: eta,
          });
        };

        const newAssets = await runWithConcurrency(
          scenes,
          SCENE_ASSET_CONCURRENCY,
          async (scene, i) => {
            const asset = await generateSceneAsset(scene, i, opts);
            const sceneCost = estimateSceneCost(
              scene.narration?.length ?? 0,
              { highQuality: options.highQuality, draft: options.draft, useVideo },
              config
            );
            addCost(sceneCost, `scene-${i}`);
            onSceneComplete();
            return asset;
          }
        );

        setProgress({
          current: total,
          total,
          phase: 'Assembling video...',
          etaSeconds: ETA_ASSEMBLY_SECONDS,
        });

        const blob = await assembleVideo(newAssets, options.captions, { signal });
        if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
        setVideoBlobUrl(URL.createObjectURL(blob));
        setAssets(newAssets);
        setTimeout(focusVideoResult, 0);
        return { ok: true };
      } catch (e) {
        const isAborted = e instanceof Error && e.name === 'AbortError';
        return {
          ok: false,
          message: isAborted ? 'Video generation cancelled' : (e instanceof Error ? e.message : 'Video creation failed'),
        };
      } finally {
        abortControllerRef.current = null;
        setProgress({ current: 0, total: 0, phase: '', etaSeconds: 0 });
      }
    },
    [focusVideoResult, addCost, canProceed, videoBlobUrl]
  );

  const regenerateScene = useCallback(
    async (
      sceneIndex: number,
      scene: Scene,
      currentAssets: SceneAssets[],
      scriptTitle: string,
      visualStyle: string | undefined,
      options: VideoGenerationOptions,
      previousBlobUrl: string | null
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      const controller = new AbortController();
      regenerateAbortRef.current = controller;
      const signal = controller.signal;
      setRegeneratingSceneIndex(sceneIndex);

      const config = await fetchProviderConfig();
      const useVideo = config.videoProvider === 'wan';

      setProgress({
        current: sceneIndex,
        total: currentAssets.length,
        phase: `Regenerating scene ${sceneIndex + 1}...`,
        etaSeconds: ETA_SECONDS_PER_SCENE + ETA_ASSEMBLY_SECONDS,
      });

      try {
        const asset = await generateSceneAsset(scene, sceneIndex, {
          ...options,
          styleGuide: visualStyle ?? scriptTitle,
          useVideo,
          signal,
        });
        const sceneCost = estimateSceneCost(
          scene.narration?.length ?? 0,
          { highQuality: options.highQuality, draft: options.draft, useVideo },
          config
        );
        addCost(sceneCost, `regenerate-scene-${sceneIndex}`);
        const newAssets = [...currentAssets];
        newAssets[sceneIndex] = asset;

        const blob = await assembleVideo(newAssets, options.captions, { signal });
        if (previousBlobUrl) URL.revokeObjectURL(previousBlobUrl);
        setVideoBlobUrl(URL.createObjectURL(blob));
        setAssets(newAssets);
        return { ok: true };
      } catch (e) {
        const isAborted = e instanceof Error && e.name === 'AbortError';
        return {
          ok: false,
          message: isAborted ? 'Regeneration cancelled' : (e instanceof Error ? e.message : 'Regenerate failed'),
        };
      } finally {
        regenerateAbortRef.current = null;
        setRegeneratingSceneIndex(null);
        setProgress({ current: 0, total: 0, phase: '', etaSeconds: 0 });
      }
    },
    [addCost]
  );

  const resetProgress = useCallback(() => {
    setProgress({ current: 0, total: 0, phase: '', etaSeconds: 0 });
  }, []);

  return {
    progress,
    videoBlobUrl,
    assets,
    setVideoBlobUrl,
    setAssets,
    videoResultRef,
    createVideo,
    regenerateScene,
    resetProgress,
    cancelVideoGeneration,
    regeneratingSceneIndex,
    cancelRegenerateScene,
  };
}
