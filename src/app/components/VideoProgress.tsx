'use client';

import { useVideoFlow } from '@/app/contexts/VideoFlowContext';
import { Card } from '@/app/components/shared/Card';
import { Button } from '@/app/components/shared/Button';

export function VideoProgress() {
  const { progress, cancelVideoGeneration } = useVideoFlow();
  const { phase, current, total, etaSeconds } = progress;

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const isAssembling = phase.toLowerCase().includes('assembling');

  return (
    <Card padding="lg" role="status" aria-live="polite" aria-label="Video generation progress">
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <div className="relative w-20 h-20 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-[var(--card-border)]" />
          <div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"
            style={{ animationDuration: '1s' }}
            aria-hidden
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl" aria-hidden>
              {isAssembling ? '🎬' : '✨'}
            </span>
          </div>
        </div>

        <h3 className="text-lg font-display font-semibold text-[var(--foreground)] mb-1">
          {phase || 'Preparing...'}
        </h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          {current} of {total} scenes
        </p>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {pct}% complete
        </p>

        <div className="w-full">
          <div className="h-2.5 bg-[var(--card-border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${pct}% complete`}
            />
          </div>
        </div>

        {etaSeconds > 0 && (
          <p className="text-xs text-[var(--muted)] mt-3">
            {etaSeconds < 60
              ? `About ${Math.ceil(etaSeconds)} sec left`
              : `About ${Math.ceil(etaSeconds / 60)} min left`}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={cancelVideoGeneration}
          className="mt-6"
          aria-label="Cancel video generation"
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}
