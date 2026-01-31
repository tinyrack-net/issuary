import { ArrowCounterClockwiseIcon, WarningIcon } from '@phosphor-icons/react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Error boundary component that catches JavaScript errors in child components.
 * Displays a fallback UI when an error occurs.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {}

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
      );
    }

    return this.props.children;
  }
}

type ErrorFallbackProps = {
  error: Error | null;
  onRetry: () => void;
};

function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-4">
      <div className="card w-full max-w-100 border border-base-200 bg-base-100 p-12 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-4">
          <div className="rounded-full bg-error/20 p-4">
            <WarningIcon className="size-8 text-error" weight="fill" />
          </div>
          <div className="text-center">
            <h1 className="font-bold text-xl">{t('error.title')}</h1>
            <p className="mt-2 text-base-content/70 text-sm">
              {t('error.defaultMessage')}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 overflow-hidden rounded-lg bg-base-200 p-3">
            <p className="break-all font-mono text-base-content/60 text-xs">
              {error.message}
            </p>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-block h-10 font-semibold text-[14px]"
          onClick={onRetry}
        >
          <ArrowCounterClockwiseIcon className="size-4" weight="bold" />
          {t('error.goBack')}
        </button>
      </div>
    </div>
  );
}
