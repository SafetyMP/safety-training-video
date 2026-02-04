'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  EST_COST_SCRIPT,
  EST_COST_IMAGE,
  EST_COST_TTS_PER_1K,
  EST_COST_VIDEO,
  SESSION_COST_WARN,
  SESSION_COST_BLOCK,
} from '@/lib/constants';
import { fetchProviderConfig, type ProviderConfig } from '@/lib/video-generation-client';

interface CostContextValue {
  totalCost: number;
  addCost: (cost: number, label?: string) => void;
  canProceed: () => boolean;
  reset: () => void;
  isWarned: boolean;
  isBlocked: boolean;
  warnThreshold: number;
  blockThreshold: number;
  /** Runtime provider config for cost estimates; null until loaded. */
  providerConfig: ProviderConfig | null;
}

const CostContext = createContext<CostContextValue | null>(null);

export function CostProvider({ children }: { children: ReactNode }) {
  const [totalCost, setTotalCost] = useState(0);
  const [config, setConfig] = useState<ProviderConfig | null>(null);

  useEffect(() => {
    fetchProviderConfig().then(setConfig);
  }, []);

  const addCost = useCallback((cost: number, _label?: string) => {
    setTotalCost((prev) => Math.round((prev + cost) * 100) / 100);
  }, []);

  const canProceed = useCallback(() => totalCost < SESSION_COST_BLOCK, [totalCost]);

  const reset = useCallback(() => setTotalCost(0), []);

  const isWarned = totalCost >= SESSION_COST_WARN;
  const isBlocked = totalCost >= SESSION_COST_BLOCK;

  const value: CostContextValue = {
    totalCost,
    addCost,
    canProceed,
    reset,
    isWarned,
    isBlocked,
    warnThreshold: SESSION_COST_WARN,
    blockThreshold: SESSION_COST_BLOCK,
    providerConfig: config,
  };

  return <CostContext.Provider value={value}>{children}</CostContext.Provider>;
}

export function useCostContext(): CostContextValue {
  const ctx = useContext(CostContext);
  if (!ctx) {
    return {
      totalCost: 0,
      addCost: () => {},
      canProceed: () => true,
      reset: () => {},
      isWarned: false,
      isBlocked: false,
      warnThreshold: SESSION_COST_WARN,
      blockThreshold: SESSION_COST_BLOCK,
      providerConfig: null,
    };
  }
  return ctx;
}

function getImageCost(highQuality: boolean, imageProvider: string): number {
  const tier = EST_COST_IMAGE[imageProvider] ?? EST_COST_IMAGE['dall-e-3'];
  return highQuality ? tier.hd : tier.standard;
}

function getTTSCostPer1k(draft: boolean, ttsProvider: string): number {
  const tier = EST_COST_TTS_PER_1K[ttsProvider] ?? EST_COST_TTS_PER_1K.openai;
  return draft ? tier.draft : tier.standard;
}

function getVideoCost(videoProvider: string): number {
  return EST_COST_VIDEO[videoProvider] ?? 0;
}

function getVisualCost(
  options: { highQuality: boolean; useVideo?: boolean },
  config: ProviderConfig | null
): number {
  const img = config?.imageProvider ?? 'dall-e-3';
  const vid = config?.videoProvider ?? 'off';
  if (options.useVideo && vid !== 'off') return getVideoCost(vid);
  return getImageCost(options.highQuality, img);
}

/** Estimate cost for a video: script + scenes (image/video + audio). Uses runtime config when available. */
export function estimateVideoCost(
  sceneCount: number,
  options: { highQuality: boolean; draft: boolean; useVideo?: boolean },
  config: ProviderConfig | null = null
): number {
  let cost = EST_COST_SCRIPT;
  const visualCost = getVisualCost(options, config);
  const avgNarrationChars = 150;
  const tts = config?.ttsProvider ?? 'openai';
  const ttsPer1k = getTTSCostPer1k(options.draft, tts);
  const audioCostPerScene = (avgNarrationChars / 1000) * ttsPer1k;
  cost += sceneCount * (visualCost + audioCostPerScene);
  return Math.round(cost * 100) / 100;
}

/** Cost for one scene asset (image/video + audio). Uses runtime config when available. */
export function estimateSceneCost(
  narrationChars: number,
  options: { highQuality: boolean; draft: boolean; useVideo?: boolean },
  config: ProviderConfig | null = null
): number {
  const visualCost = getVisualCost(options, config);
  const tts = config?.ttsProvider ?? 'openai';
  const ttsPer1k = getTTSCostPer1k(options.draft, tts);
  const audioCost = (narrationChars / 1000) * ttsPer1k;
  return Math.round((visualCost + audioCost) * 100) / 100;
}
