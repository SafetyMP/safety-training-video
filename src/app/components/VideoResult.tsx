'use client';

import { useVideoFlow } from '@/app/contexts/VideoFlowContext';
import { Card } from '@/app/components/shared/Card';
import { Button } from '@/app/components/shared/Button';

export function VideoResult() {
  const {
    videoBlobUrl,
    assets,
    handleRegenerateScene,
    handleStartOver,
    videoResultRef,
    regeneratingSceneIndex,
    cancelRegenerateScene,
  } = useVideoFlow();

  if (!videoBlobUrl) return null;

  const isRegenerating = regeneratingSceneIndex !== null;

  return (
    <div
      ref={videoResultRef as React.Ref<HTMLDivElement>}
      className="space-y-6"
      tabIndex={-1}
    >
      <h2 className="text-xl font-display font-semibold text-[var(--foreground)]">
        Your video
      </h2>

      <Card padding="none">
        <div className="relative aspect-video bg-black rounded-t-card overflow-hidden">
          <video
            src={videoBlobUrl}
            controls
            aria-label="Generated safety training video"
            className="w-full h-full object-contain"
          />
          {isRegenerating && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white"
              role="status"
              aria-live="polite"
            >
              <span
                className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden
              />
              <span className="font-medium">
                Regenerating scene {regeneratingSceneIndex! + 1}…
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelRegenerateScene}
                className="text-white hover:bg-white/20 border border-white/30"
                aria-label="Cancel regeneration"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </Card>

      {assets && assets.length > 0 && (
        <Card padding="md">
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
            Regenerate one scene
          </h3>
          <div className="flex flex-wrap gap-2">
            {assets.map((_, i) => (
              <Button
                key={`regenerate-${i}`}
                variant="secondary"
                size="sm"
                onClick={() => handleRegenerateScene(i)}
                disabled={isRegenerating}
                aria-disabled={isRegenerating}
                aria-busy={regeneratingSceneIndex === i}
                isLoading={regeneratingSceneIndex === i}
              >
                Scene {i + 1}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={videoBlobUrl}
          download="safety-training-video.mp4"
          aria-label="Download safety training video (MP4)"
          className="inline-flex flex-1 items-center justify-center px-6 py-3 text-base font-medium
            bg-primary text-primary-foreground rounded-lg
            hover:bg-primary-hover transition-colors
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          Download video
        </a>
        <Button
          variant="outline"
          fullWidth
          size="lg"
          onClick={handleStartOver}
        >
          Create another video
        </Button>
      </div>
    </div>
  );
}
