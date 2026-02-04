'use client';

import type { Step } from '@/app/contexts/VideoFlowContext';

const STEPS: { id: Step; label: string }[] = [
  { id: 'idle', label: 'Describe' },
  { id: 'script', label: 'Edit script' },
  { id: 'generating', label: 'Creating' },
  { id: 'video', label: 'Download' },
];

function stepIndex(step: Step): number {
  const i = STEPS.findIndex((s) => s.id === step);
  return i >= 0 ? i : 0;
}

export function StepStepper({ currentStep }: { currentStep: Step }) {
  const currentIdx = stepIndex(currentStep);

  return (
    <nav
      aria-label="Progress"
      className="flex items-center justify-between w-full max-w-2xl mx-auto"
    >
      {STEPS.map((step, i) => {
        const isComplete = i < currentIdx || (currentStep === 'video' && i === 3);
        const isCurrent =
          step.id === currentStep ||
          (currentStep === 'generating' && step.id === 'generating');

        return (
          <div
            key={step.id}
            className="flex flex-1 items-center"
          >
            <div className="flex flex-col items-center flex-1">
              <div
                className={`
                  flex h-10 w-10 items-center justify-center rounded-full
                  text-sm font-medium transition-all duration-200
                  ${
                    isComplete
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900 bg-primary text-primary-foreground'
                        : 'bg-[var(--card-border)] text-[var(--muted)]'
                  }
                `}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isComplete && step.id !== 'generating' ? (
                  <span aria-hidden>✓</span>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium ${
                  isCurrent || isComplete
                    ? 'text-[var(--foreground)]'
                    : 'text-[var(--muted)]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 rounded transition-colors ${
                  i < currentIdx ? 'bg-primary' : 'bg-[var(--card-border)]'
                }`}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
