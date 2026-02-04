'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import type { ScriptResult, Scene, SceneAssets } from '@/lib/types';
import type { VideoProgress } from '@/app/hooks/useVideoGeneration';
import { useHealthCheck } from '@/app/hooks/useHealthCheck';
import { useScriptGeneration } from '@/app/hooks/useScriptGeneration';
import { useVideoGeneration } from '@/app/hooks/useVideoGeneration';
import { useCostContext } from '@/app/contexts/CostContext';
import type { VisualStylePreset } from '@/lib/constants';

export type Step = 'idle' | 'script' | 'generating' | 'video';

interface VideoFlowContextValue {
  // Step
  step: Step;
  setStep: (s: Step) => void;

  // Form state
  prompt: string;
  setPrompt: (v: string) => void;
  voice: string;
  setVoice: (v: string) => void;
  audience: string;
  setAudience: (v: string) => void;
  draftMode: boolean;
  setDraftMode: (v: boolean) => void;
  highQualityImages: boolean;
  setHighQualityImages: (v: boolean) => void;
  captions: boolean;
  setCaptions: (v: boolean) => void;
  visualStylePreset: VisualStylePreset;
  setVisualStylePreset: (v: VisualStylePreset) => void;
  safetyKeywords: string;
  setSafetyKeywords: (v: string) => void;

  // Script
  script: ScriptResult | null;
  scenesForVideo: Scene[];
  error: string | null;
  clearError: () => void;
  scriptResultRef: React.RefObject<HTMLDivElement | null>;
  updateSceneNarration: (index: number, narration: string) => void;
  getSceneNarration: (index: number) => string;
  flushNarrationUpdates: () => void;

  // Video
  progress: VideoProgress;
  videoBlobUrl: string | null;
  assets: SceneAssets[] | null;
  videoResultRef: React.RefObject<HTMLDivElement | null>;
  regeneratingSceneIndex: number | null;

  // Actions
  handleGenerateScript: () => Promise<void>;
  handleCreateVideo: () => Promise<void>;
  handleRegenerateScene: (index: number) => void | Promise<void>;
  handleStartOver: () => void;
  cancelVideoGeneration: () => void;
  cancelRegenerateScene: () => void;
  retryCreateVideo: (() => void) | null;
  showRetryButton: boolean;

  // Meta
  openaiConfigured: boolean | null;
  isCostWarned: boolean;
  isCostBlocked: boolean;
  totalCost: number;
}

const VideoFlowContext = createContext<VideoFlowContextValue | null>(null);

export function VideoFlowProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<Step>('idle');
  const [prompt, setPrompt] = useState('');
  const [voice, setVoice] = useState('onyx');
  const [audience, setAudience] = useState('');
  const [draftMode, setDraftMode] = useState(true);
  const [highQualityImages, setHighQualityImages] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [visualStylePreset, setVisualStylePreset] = useState<VisualStylePreset>('illustration');
  const [safetyKeywords, setSafetyKeywords] = useState('');
  const [showRetry, setShowRetry] = useState(false);
  const createVideoRef = useRef<(() => Promise<void>) | null>(null);

  const openaiConfigured = useHealthCheck();
  const { totalCost, reset: resetCost, isWarned: isCostWarned, isBlocked: isCostBlocked } = useCostContext();
  const {
    script,
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
  } = useScriptGeneration();
  const {
    progress,
    videoBlobUrl,
    assets,
    setVideoBlobUrl,
    setAssets,
    videoResultRef,
    createVideo,
    regenerateScene,
    cancelVideoGeneration,
    regeneratingSceneIndex,
    cancelRegenerateScene,
  } = useVideoGeneration();

  const handleGenerateScript = useCallback(async () => {
    setStep('script');
    const ok = await generateScript({ prompt, draft: draftMode, audience, visualStylePreset, safetyKeywords });
    if (!ok) setStep('idle');
  }, [prompt, draftMode, audience, visualStylePreset, safetyKeywords, generateScript]);

  const handleCreateVideo = useCallback(async () => {
    if (!script?.scenes?.length || scenesForVideo.length === 0) return;
    flushNarrationUpdates();
    setError(null);
    setVideoBlobUrl(null);
    setAssets(null);
    setStep('generating');
    const scenesToUse = scenesForVideo.map((s, i) => ({
      ...s,
      narration: getSceneNarration(i) || s.narration,
    }));
    const result = await createVideo(scenesToUse, script.title, script.visualStyle, {
      highQuality: highQualityImages,
      voice,
      draft: draftMode,
      captions,
      safetyKeywords: safetyKeywords || undefined,
    });
    if (result.ok) {
      setStep('video');
      setShowRetry(false);
    } else {
      setError(result.message);
      setStep('script');
      setShowRetry(true);
      createVideoRef.current = handleCreateVideo as () => Promise<void>;
    }
  }, [
    script,
    scenesForVideo,
    getSceneNarration,
    flushNarrationUpdates,
    highQualityImages,
    voice,
    draftMode,
    captions,
    safetyKeywords,
    createVideo,
    setError,
    setVideoBlobUrl,
    setAssets,
  ]);

  const handleRegenerateScene = useCallback(
    async (index: number) => {
      if (!script || !assets) return;
      const scene = scenesForVideo[index];
      if (!scene) return;
      setError(null);
      const result = await regenerateScene(
        index,
        scene,
        assets,
        script.title,
        script.visualStyle,
        { highQuality: highQualityImages, voice, draft: draftMode, captions, safetyKeywords: safetyKeywords || undefined },
        videoBlobUrl
      );
      if (!result.ok) setError(result.message);
    },
    [
      script,
      assets,
      scenesForVideo,
      highQualityImages,
      voice,
      draftMode,
      captions,
      safetyKeywords,
      videoBlobUrl,
      regenerateScene,
      setError,
    ]
  );

  const handleStartOver = useCallback(() => {
    if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    setVideoBlobUrl(null);
    setAssets(null);
    setScript(null);
    setEditedScenes(null);
    setShowRetry(false);
    resetCost();
    setStep('idle');
  }, [videoBlobUrl, setVideoBlobUrl, setAssets, setScript, setEditedScenes, resetCost]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const retryCreateVideo = useCallback(() => {
    if (createVideoRef.current) createVideoRef.current();
  }, []);

  const value: VideoFlowContextValue = {
    step,
    setStep,
    prompt,
    setPrompt,
    voice,
    setVoice,
    audience,
    setAudience,
    draftMode,
    setDraftMode,
    highQualityImages,
    setHighQualityImages,
    captions,
    setCaptions,
    visualStylePreset,
    setVisualStylePreset,
    safetyKeywords,
    setSafetyKeywords,
    script,
    scenesForVideo,
    error,
    clearError,
    scriptResultRef,
    updateSceneNarration,
    getSceneNarration,
    flushNarrationUpdates,
    progress,
    videoBlobUrl,
    assets,
    videoResultRef,
    regeneratingSceneIndex,
    handleGenerateScript,
    handleCreateVideo,
    handleRegenerateScene,
    handleStartOver,
    cancelVideoGeneration,
    cancelRegenerateScene,
    retryCreateVideo: showRetry ? retryCreateVideo : null,
    showRetryButton: showRetry,
    openaiConfigured,
    isCostWarned: isCostWarned,
    isCostBlocked: isCostBlocked,
    totalCost,
  };

  return (
    <VideoFlowContext.Provider value={value}>{children}</VideoFlowContext.Provider>
  );
}

export function useVideoFlow(): VideoFlowContextValue {
  const ctx = useContext(VideoFlowContext);
  if (!ctx) throw new Error('useVideoFlow must be used within VideoFlowProvider');
  return ctx;
}
