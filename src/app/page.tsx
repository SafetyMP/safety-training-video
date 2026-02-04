'use client';

import { CostProvider } from '@/app/contexts/CostContext';
import { ThemeProvider } from '@/app/contexts/ThemeContext';
import { VideoFlowProvider, useVideoFlow } from '@/app/contexts/VideoFlowContext';
import { ScriptForm } from '@/app/components/ScriptForm';
import { ScriptEditor } from '@/app/components/ScriptEditor';
import { VideoProgress } from '@/app/components/VideoProgress';
import { VideoResult } from '@/app/components/VideoResult';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { useKeyboardShortcuts } from '@/app/hooks/useKeyboardShortcuts';
import { StepStepper } from '@/app/components/layout/StepStepper';
import { Sidebar } from '@/app/components/layout/Sidebar';
import { Header } from '@/app/components/layout/Header';
import { Card } from '@/app/components/shared/Card';

function HomeContent() {
  const {
    step,
    script,
    error,
    clearError,
    retryCreateVideo,
    openaiConfigured,
    isCostBlocked,
    handleGenerateScript,
    handleCreateVideo,
    cancelVideoGeneration,
    regeneratingSceneIndex,
    cancelRegenerateScene,
  } = useVideoFlow();

  useKeyboardShortcuts({
    onGenerate: () => {
      if (step === 'idle') handleGenerateScript();
      else if (step === 'script' && script && !isCostBlocked) handleCreateVideo();
    },
    onCancel: () => {
      if (step === 'generating') cancelVideoGeneration();
      else if (step === 'video' && regeneratingSceneIndex !== null) cancelRegenerateScene();
    },
  });

  const stepperStep = step === 'idle' ? 'idle' : step;

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-lg"
      >
        Skip to main content
      </a>
      <div className="border-b border-[var(--card-border)] bg-[var(--card)] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
          <div className="pb-4">
            <StepStepper currentStep={stepperStep} />
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          <main
            className="flex-1 min-w-0"
            role="main"
            aria-label="Safety Training Video Creator"
            id="main-content"
          >
            <p className="text-sm text-[var(--muted)] mb-6" id="intro-desc">
              Describe the video you want in plain language. We&apos;ll generate a
              script with matching visuals, then create the video.
            </p>

            {openaiConfigured === false && (
              <Card
                padding="md"
                className="mb-6 border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10"
              >
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Set <code className="bg-amber-200/50 dark:bg-amber-500/30 px-1 rounded">OPENAI_API_KEY</code> in{' '}
                  <code className="bg-amber-200/50 dark:bg-amber-500/30 px-1 rounded">.env</code> to
                  generate scripts. Image and audio can use Replicate (Tier 2/3) when configured.
                </p>
              </Card>
            )}

            {step === 'idle' && <ScriptForm />}

            {step === 'script' && !script && !error && (
              <Card padding="lg" role="status" aria-live="polite">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin"
                    aria-hidden
                  />
                  <p className="text-[var(--foreground)] font-medium">Generating script…</p>
                  <div className="w-full max-w-xs h-2 bg-[var(--card-border)] rounded-full overflow-hidden">
                    <div
                      className="h-full w-1/3 bg-primary animate-pulse rounded-full"
                      aria-hidden
                    />
                  </div>
                </div>
              </Card>
            )}

            {script && (step === 'script' || step === 'generating') && <ScriptEditor />}

            {step === 'generating' && <VideoProgress />}

            {step === 'video' && <VideoResult />}

            {error && step !== 'script' && (
              <Card
                padding="md"
                className="mt-6 border-red-500/50 bg-red-500/5 dark:bg-red-500/10"
                role="alert"
                aria-live="polite"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                  <button
                    type="button"
                    onClick={clearError}
                    className="text-xs font-medium text-red-700 dark:text-red-200 hover:text-red-800 dark:hover:text-red-100"
                    aria-label="Dismiss error"
                  >
                    Dismiss
                  </button>
                </div>
                {retryCreateVideo && (
                  <button
                    type="button"
                    onClick={retryCreateVideo}
                    className="mt-3 px-3 py-1.5 text-sm font-medium bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded text-red-800 dark:text-red-200"
                  >
                    Retry
                  </button>
                )}
              </Card>
            )}

            <p className="mt-8 text-xs text-[var(--muted)]">
              Review content for accuracy before using in official training. You are billed by
              OpenAI and/or Replicate depending on your provider configuration.
            </p>
          </main>

          <Sidebar />
        </div>
      </div>
    </div>
  );
}

const ErrorFallback = () => (
  <div className="min-h-screen flex items-center justify-center p-8">
    <div className="max-w-md text-center">
      <h1 className="text-xl font-display font-semibold text-[var(--foreground)] mb-2">
        Something went wrong
      </h1>
      <p className="text-[var(--muted)] mb-4">
        Please refresh the page to try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Refresh page
      </button>
    </div>
  </div>
);

export default function Home() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <ThemeProvider>
        <CostProvider>
          <VideoFlowProvider>
            <HomeContent />
          </VideoFlowProvider>
        </CostProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
