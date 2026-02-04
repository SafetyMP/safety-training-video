'use client';

import { useEffect, useState } from 'react';
import { fetchProviderConfig } from '@/lib/video-generation-client';
import { EST_COST_VIDEO } from '@/lib/constants';

const IMAGE_LABELS: Record<string, string> = {
  'dall-e-3': 'DALL-E 3',
  'gpt-image-1-mini': 'GPT Image 1 Mini',
  sdxl: 'SDXL (Replicate)',
  flux: 'Flux (Replicate)',
};

const TTS_LABELS: Record<string, string> = {
  openai: 'OpenAI TTS',
  edge: 'Edge TTS (free)',
  kokoro: 'Kokoro (Replicate)',
};

export function ProviderCapabilities() {
  const [config, setConfig] = useState<{
    imageProvider: string;
    ttsProvider: string;
    videoProvider: string;
  } | null>(null);

  useEffect(() => {
    fetchProviderConfig().then((c) =>
      setConfig({
        imageProvider: c.imageProvider ?? 'dall-e-3',
        ttsProvider: c.ttsProvider ?? 'openai',
        videoProvider: c.videoProvider ?? 'off',
      })
    );
  }, []);

  if (!config) {
    return (
      <div
        className="text-sm text-[var(--muted)] min-h-[1.5rem]"
        role="status"
        aria-label="Loading providers"
      >
        <div className="space-y-2 animate-pulse">
          <div className="h-3 w-40 bg-[var(--card-border)] rounded-full" />
          <div className="h-2.5 w-24 bg-[var(--card-border)] rounded-full" />
          <span className="sr-only">Checking providers…</span>
        </div>
      </div>
    );
  }

  const visualLabel =
    config.videoProvider === 'wan'
      ? 'AI video clips (Wan 2.1)'
      : IMAGE_LABELS[config.imageProvider] ?? config.imageProvider;
  const audioLabel = TTS_LABELS[config.ttsProvider] ?? config.ttsProvider;
  const videoCostPerScene = config.videoProvider === 'wan' ? EST_COST_VIDEO.wan : null;

  return (
    <div
      className="text-sm text-[var(--muted)]"
      role="status"
      aria-label="Active AI providers"
    >
      <span className="font-medium text-[var(--foreground)]">Active: </span>
      <span>
        {visualLabel}
        <span className="text-[var(--muted-foreground)] mx-1">·</span>
        {audioLabel}
      </span>
      {videoCostPerScene != null && (
        <p className="mt-1 text-xs text-[var(--muted)]">
          Video clips: ~${videoCostPerScene.toFixed(2)} per scene
        </p>
      )}
    </div>
  );
}
