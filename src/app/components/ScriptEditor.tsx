'use client';

import { useState } from 'react';
import { Button } from '@/app/components/shared/Button';
import { Card } from '@/app/components/shared/Card';
import { useCostContext, estimateVideoCost } from '@/app/contexts/CostContext';
import { useVideoFlow } from '@/app/contexts/VideoFlowContext';
import type { Scene, EHSValidation, FactVerificationResult } from '@/lib/types';

function FactVerificationBanner({ results }: { results: FactVerificationResult[] }) {
  const [expanded, setExpanded] = useState(false);
  const verified = results.filter((r) => r.status === 'verified');
  const needsReview = results.filter((r) => r.status === 'needs_review');
  const unverified = results.filter((r) => r.status === 'unverified');

  if (results.length === 0) return null;

  return (
    <Card padding="sm" className="border-l-4 border-l-primary">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left font-medium text-[var(--foreground)] hover:text-primary transition-colors"
        aria-expanded={expanded}
      >
        Fact verification
        <span className="text-xs font-normal text-[var(--muted)]">
          {verified.length} verified
          {needsReview.length > 0 && ` · ${needsReview.length} need review`}
          {unverified.length > 0 && ` · ${unverified.length} unverified`}
        </span>
        <span
          className={`ml-auto text-[var(--muted)] transform transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>
      {expanded ? <ul className="mt-3 space-y-2 list-none pl-0 border-t border-[var(--card-border)] pt-3">
          {results.map((r, i) => (
            <li
              key={`fv-${i}`}
              className={`pl-3 border-l-2 ${
                r.status === 'verified'
                  ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20'
                  : r.status === 'needs_review'
                    ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/20'
                    : 'border-red-500 bg-red-500/10 dark:bg-red-500/20'
              }`}
            >
              <span className="font-medium text-[var(--foreground)]">
                Scene {r.sceneIndex + 1} · {r.type}:
              </span>{' '}
              <span className="italic">&quot;{r.claim}&quot;</span>
              <span
                className={`ml-1 text-xs ${
                  r.status === 'verified'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : r.status === 'needs_review'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                }`}
              >
                ({r.status.replace('_', ' ')})
              </span>
              {r.source ? <p className="mt-0.5 text-xs text-[var(--muted)]">Source: {r.source}</p> : null}
              {r.correction ? <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                  Suggested: {r.correction}
                </p> : null}
            </li>
          ))}
        </ul> : null}
    </Card>
  );
}

function EHSValidationBanner({ validation }: { validation: EHSValidation }) {
  const [expanded, setExpanded] = useState(false);
  const { warnings, mythsFlagged, terminologySuggestions, missingRecommendations } = validation;
  const hasWarnings = (warnings?.length ?? 0) > 0;
  const hasTerminology = (terminologySuggestions?.length ?? 0) > 0;
  const hasMyths = (mythsFlagged?.length ?? 0) > 0;
  const hasMissing = (missingRecommendations?.length ?? 0) > 0;
  if (!hasWarnings && !hasTerminology && !hasMyths && !hasMissing) return null;

  return (
    <Card padding="sm" className="border-l-4 border-l-accent">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left font-medium text-[var(--foreground)] hover:text-primary transition-colors"
        aria-expanded={expanded}
      >
        EHS reference check
        <span
          className={`ml-auto text-[var(--muted)] transform transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>
      {expanded ? <ul className="mt-3 space-y-1 list-disc list-inside text-sm text-[var(--muted)] border-t border-[var(--card-border)] pt-3">
          {hasWarnings ? warnings!.map((w, i) => <li key={`w-${i}`}>{w}</li>) : null}
          {hasMyths ? <li>Myths / avoid: {mythsFlagged!.join('; ')}</li> : null}
          {hasTerminology ? <li>
              Prefer:{' '}
              {terminologySuggestions!.map((s) => `"${s.prefer}" over "${s.found}"`).join('; ')}
            </li> : null}
          {hasMissing ? missingRecommendations!.slice(0, 5).map((m, i) => <li key={`m-${i}`}>{m}</li>) : null}
        </ul> : null}
    </Card>
  );
}

/** Stable key for scene list items. */
function sceneKey(s: Scene, i: number): string {
  return `scene-${i}-${s.narration.slice(0, 20)}`;
}

export function ScriptEditor() {
  const {
    script,
    scenesForVideo,
    getSceneNarration,
    updateSceneNarration,
    handleCreateVideo,
    step,
    draftMode,
    highQualityImages,
    scriptResultRef,
    isCostBlocked,
    error,
    retryCreateVideo,
  } = useVideoFlow();
  const { providerConfig } = useCostContext();

  const estCost = estimateVideoCost(
    scenesForVideo.length,
    {
      highQuality: highQualityImages,
      draft: draftMode,
      useVideo: providerConfig?.videoProvider === 'wan',
    },
    providerConfig
  );

  if (!script) return null;

  const showCreateButton = step === 'script';
  const costBlockedMessage = isCostBlocked
    ? 'Session cost limit reached. Start over to reset.'
    : undefined;

  return (
    <div ref={scriptResultRef as React.Ref<HTMLDivElement>} className="space-y-5" tabIndex={-1}>
      <h2 className="text-xl font-display font-semibold text-[var(--foreground)]">{script.title}</h2>

      {script.unverifiedSignMentions && script.unverifiedSignMentions.length > 0 ? <Card
          padding="sm"
          className="border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10"
          role="status"
        >
          <span className="font-medium text-amber-800 dark:text-amber-200">
            Unverified sign mentions (review for accuracy):
          </span>
          <ul className="mt-1 list-disc list-inside text-sm text-amber-700 dark:text-amber-300">
            {script.unverifiedSignMentions.map(({ sceneIndex, mentions }) => (
              <li key={sceneIndex}>
                Scene {sceneIndex + 1}: {mentions.join(', ')} — use standard signs (EXIT, CAUTION,
                DANGER, PPE, etc.) when possible.
              </li>
            ))}
          </ul>
        </Card> : null}

      {script.ehsValidation ? <EHSValidationBanner validation={script.ehsValidation} /> : null}
      {script.factVerification && script.factVerification.length > 0 ? <FactVerificationBanner results={script.factVerification} /> : null}

      {script.regulatorySources && script.regulatorySources.length > 0 ? <p className="text-xs text-[var(--muted)]" role="status">
          Live regulations used: {script.regulatorySources.join(', ')}
        </p> : null}

      <p className="text-sm text-[var(--muted)]">
        Edit narration below if you like, then create the video. Approx.{' '}
        <strong className="text-[var(--foreground)]">${estCost.toFixed(2)}</strong> per video.
        {providerConfig?.videoProvider === 'wan' && (
          <span className="block mt-1">Using AI video clips (Wan 2.1) for each scene.</span>
        )}
      </p>

      <ul className="space-y-4" role="list" aria-label="Script scenes">
        {scenesForVideo.map((s, i) => (
          <SceneCard
            key={sceneKey(s, i)}
            index={i}
            scene={s}
            narration={getSceneNarration(i)}
            onNarrationChange={(v) => updateSceneNarration(i, v)}
          />
        ))}
      </ul>

      {showCreateButton ? <div className="space-y-4 pt-2">
          {error ? <Card
              padding="md"
              className="border-red-500/50 bg-red-500/5 dark:bg-red-500/10"
              role="alert"
              aria-live="polite"
            >
              <p className="text-red-700 dark:text-red-300">{error}</p>
              {retryCreateVideo ? <Button
                  variant="destructive"
                  size="sm"
                  onClick={retryCreateVideo}
                  className="mt-3"
                >
                  Retry
                </Button> : null}
            </Card> : null}
          {isCostBlocked && costBlockedMessage ? <p className="text-sm text-amber-600 dark:text-amber-400" role="alert">
              {costBlockedMessage}
            </p> : null}
          <Button
            onClick={handleCreateVideo}
            disabled={isCostBlocked}
            aria-label="Create video from script"
            fullWidth
            size="lg"
          >
            Create video
          </Button>
          <p className="text-xs text-[var(--muted)] text-center">
            <kbd className="px-1.5 py-0.5 bg-[var(--card-border)] rounded text-[var(--foreground)]">
              ⌘
            </kbd>
            +
            <kbd className="px-1.5 py-0.5 bg-[var(--card-border)] rounded text-[var(--foreground)]">
              Enter
            </kbd>
            to create ·
            <kbd className="px-1.5 py-0.5 bg-[var(--card-border)] rounded text-[var(--foreground)] ml-1">
              Esc
            </kbd>
            to cancel
          </p>
        </div> : null}
    </div>
  );
}

function SceneCard({
  index,
  scene,
  narration,
  onNarrationChange,
}: {
  index: number;
  scene: Scene;
  narration: string;
  onNarrationChange: (v: string) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const textareaId = `scene-narration-${index}`;
  const labelId = `scene-label-${index}`;

  return (
    <Card padding="md" as="li" role="listitem">
      <div className="flex items-center justify-between mb-2">
        <label
          id={labelId}
          htmlFor={textareaId}
          className="text-sm font-medium text-[var(--muted)]"
        >
          Scene {index + 1}
        </label>
        <button
          type="button"
          onClick={() => setShowPrompt(!showPrompt)}
          className="text-xs text-primary hover:underline"
          aria-expanded={showPrompt}
          aria-controls={`image-prompt-${index}`}
        >
          {showPrompt ? 'Hide image prompt' : 'Show image prompt'}
        </button>
      </div>
      {showPrompt ? <p
          id={`image-prompt-${index}`}
          className="text-xs text-[var(--muted)] italic mb-3 p-2 rounded bg-[var(--background)]"
          title={scene.imagePrompt}
        >
          {scene.imagePrompt}
        </p> : null}
      <textarea
        id={textareaId}
        aria-labelledby={labelId}
        aria-describedby={showPrompt ? `image-prompt-${index}` : undefined}
        className="w-full min-h-[5rem] px-3 py-2 border border-[var(--card-border)] rounded-card
          bg-[var(--card)] text-[var(--foreground)]
          placeholder:text-[var(--muted)]
          focus:ring-2 focus:ring-primary focus:border-transparent
          resize-y text-sm"
        value={narration}
        onChange={(e) => onNarrationChange(e.target.value)}
        placeholder="Narration for this scene"
      />
    </Card>
  );
}
