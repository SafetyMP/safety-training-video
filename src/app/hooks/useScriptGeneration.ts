'use client';

import { useState, useCallback, useRef } from 'react';
import { useCostContext } from '@/app/contexts/CostContext';
import { fetchJson } from '@/lib/api-client';
import { EST_COST_SCRIPT } from '@/lib/constants';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import type { VisualStylePreset } from '@/lib/constants';
import type { ScriptResult, Scene } from '@/lib/types';

export interface ScriptGenerationOptions {
  prompt: string;
  draft: boolean;
  audience: string;
  visualStylePreset?: VisualStylePreset;
  safetyKeywords?: string;
}

export function useScriptGeneration() {
  const { addCost } = useCostContext();
  const [script, setScript] = useState<ScriptResult | null>(null);
  const [editedScenes, setEditedScenes] = useState<Scene[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scriptResultRef = useRef<HTMLDivElement>(null);

  const focusScriptResult = useCallback(() => {
    scriptResultRef.current?.focus({ preventScroll: true });
  }, []);

  const generateScript = useCallback(
    async (options: ScriptGenerationOptions) => {
      const { prompt, draft, audience, visualStylePreset, safetyKeywords } = options;
      if (!prompt.trim()) return false;
      setError(null);
      setEditedScenes(null);
      const result = await fetchJson<ScriptResult>('/api/generate-script', {
        prompt: prompt.trim(),
        draft,
        audience: audience || undefined,
        visualStylePreset: visualStylePreset || undefined,
        safetyKeywords: safetyKeywords?.trim() || undefined,
      });
      if (result.ok) {
        addCost(EST_COST_SCRIPT, 'script');
        setScript(result.data);
        setEditedScenes(result.data.scenes ? [...result.data.scenes] : null);
        setTimeout(focusScriptResult, 0);
        return true;
      }
      setError(result.error.message);
      return false;
    },
    [focusScriptResult, addCost]
  );

  const pendingNarrationRef = useRef<Record<number, string>>({});
  const [, setTick] = useState(0);

  const applyAllPendingNarrations = useCallback(() => {
    const pending = pendingNarrationRef.current;
    if (Object.keys(pending).length === 0) return;
    const toApply = { ...pending };
    pendingNarrationRef.current = {};
    setEditedScenes((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      for (const [k, v] of Object.entries(toApply)) {
        const i = Number(k);
        if (i >= 0 && i < next.length) next[i] = { ...next[i], narration: v };
      }
      return next;
    });
  }, []);

  const { debounced: debouncedApply, flush: flushNarrationUpdates } =
    useDebouncedCallback(applyAllPendingNarrations, 300);

  const updateSceneNarration = useCallback(
    (index: number, narration: string) => {
      pendingNarrationRef.current[index] = narration;
      setTick((t) => t + 1);
      debouncedApply();
    },
    [debouncedApply]
  );

  const getSceneNarration = useCallback(
    (index: number): string => {
      const pending = pendingNarrationRef.current[index];
      if (pending !== undefined) return pending;
      const fromEdited = editedScenes?.[index]?.narration;
      if (fromEdited !== undefined) return fromEdited;
      return script?.scenes?.[index]?.narration ?? '';
    },
    [editedScenes, script]
  );

  const scenesForVideo = (editedScenes?.length ? editedScenes : script?.scenes) ?? [];

  return {
    script,
    editedScenes,
    scenesForVideo,
    getSceneNarration,
    error,
    setError,
    scriptResultRef,
    generateScript,
    updateSceneNarration,
    flushNarrationUpdates,
    setScript,
    setEditedScenes,
  };
}
