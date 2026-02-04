'use client';

import { useCostContext, estimateVideoCost } from '@/app/contexts/CostContext';
import { useVideoFlow } from '@/app/contexts/VideoFlowContext';

export function CostBreakdown() {
  const {
    totalCost,
    isWarned,
    isBlocked,
    warnThreshold,
    blockThreshold,
    providerConfig,
  } = useCostContext();
  const {
    step,
    script,
    scenesForVideo,
    draftMode,
    highQualityImages,
  } = useVideoFlow();

  const estVideoCost =
    script && scenesForVideo.length > 0
      ? estimateVideoCost(
          scenesForVideo.length,
          {
            highQuality: highQualityImages,
            draft: draftMode,
            useVideo: providerConfig?.videoProvider === 'wan',
          },
          providerConfig
        )
      : null;
  const limitProgress =
    blockThreshold > 0 ? Math.min((totalCost / blockThreshold) * 100, 100) : 0;

  return (
    <div
      className="space-y-2 text-sm"
      role="status"
      aria-live="polite"
      aria-label="Session cost information"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[var(--muted)]">Session cost</span>
        <span
          className={`font-medium tabular-nums ${
            isBlocked
              ? 'text-red-600 dark:text-red-400'
              : isWarned
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-[var(--foreground)]'
          }`}
        >
          ${totalCost.toFixed(2)}
        </span>
      </div>
      {blockThreshold > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isBlocked ? 'bg-red-500' : isWarned ? 'bg-amber-500' : 'bg-primary'
              }`}
              style={{ width: `${limitProgress}%` }}
              aria-hidden
            />
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Limit: ${blockThreshold.toFixed(2)}
          </p>
        </div>
      )}
      {isWarned && !isBlocked && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Approaching ${blockThreshold.toFixed(2)} limit
        </p>
      )}
      {isBlocked && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Limit reached. Start over to reset.
        </p>
      )}
      {estVideoCost != null && step !== 'video' && (
        <p className="text-xs text-[var(--muted)]">
          Est. next video: ~${estVideoCost.toFixed(2)}
        </p>
      )}
    </div>
  );
}
