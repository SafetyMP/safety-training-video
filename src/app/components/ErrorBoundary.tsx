'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Custom fallback UI. If not provided, uses default error display. */
  fallback?: ReactNode;
  /** Called when user clicks "Try Again" */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary for catching and displaying component errors.
 * Prevents entire app from crashing when a single component fails.
 *
 * Usage:
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div
          className="min-h-[200px] flex items-center justify-center p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="text-center max-w-md">
            <div className="text-red-500 text-4xl mb-4" aria-hidden="true">⚠️</div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              Something went wrong
            </h2>
            <p className="text-slate-600 mb-4">
              An error occurred while rendering this section. Please try again.
            </p>
            {this.state.error && (
              <p className="text-sm text-slate-500 mb-4 font-mono bg-slate-100 p-2 rounded">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Pre-built fallback component for video generation errors.
 */
export function VideoErrorFallback({ onRetry }: { onRetry?: () => void }): ReactNode {
  return (
    <div
      className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="text-red-500 text-3xl mb-3" aria-hidden="true">🎬</div>
      <h3 className="text-lg font-medium text-red-800 mb-2">
        Video Generation Error
      </h3>
      <p className="text-red-600 mb-4">
        There was a problem generating your video. This may be due to a temporary service issue.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry Generation
        </button>
      )}
    </div>
  );
}

/**
 * Pre-built fallback component for script generation errors.
 */
export function ScriptErrorFallback({ onRetry }: { onRetry?: () => void }): ReactNode {
  return (
    <div
      className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="text-amber-500 text-3xl mb-3" aria-hidden="true">📝</div>
      <h3 className="text-lg font-medium text-amber-800 mb-2">
        Script Generation Error
      </h3>
      <p className="text-amber-600 mb-4">
        There was a problem generating your script. Please try again with a different prompt.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
