import type { ErrorComponentProps } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { CircleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { TinyAuthError } from '#frontend/libs/error.ts';

/**
 * Minimal error layout that does NOT depend on any queries.
 *
 * Unlike `PageLayout`, this component never calls
 * `useSuspenseQuery` so it is safe to render even when
 * the network or session is broken.
 */
function MinimalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-tinyrack-canvas p-4">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-100 rounded-tinyrack-lg border border-tinyrack-border bg-tinyrack-surface p-12 shadow-tinyrack-raised">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Check whether an error represents a 401 Unauthorized
 * response from the backend.
 */
function isUnauthorizedError(error: Error): boolean {
  return error instanceof TinyAuthError && error.status === 401;
}

type RouteErrorFallbackProps = ErrorComponentProps & {
  /**
   * Called when the error is a 401 Unauthorized.
   * The component will invoke this and render nothing
   * while the redirect is in progress.
   *
   * If omitted, a generic "go to login" button is shown
   * instead.
   */
  onUnauthorized?: () => void;
};

/**
 * Reusable error fallback for route `errorComponent`.
 *
 * - 401 errors: triggers `onUnauthorized` callback (or shows
 *   a "go to login" link).
 * - Other errors: displays error code / message and a retry
 *   button.
 */
export function RouteErrorFallback({
  error,
  reset,
  onUnauthorized,
}: RouteErrorFallbackProps) {
  const { t } = useTranslation();

  // --- 401 Unauthorized ---
  if (isUnauthorizedError(error)) {
    if (onUnauthorized) {
      onUnauthorized();

      // Render a minimal loading state while the redirect
      // happens so the user does not see a flash of error UI.
      return (
        <MinimalLayout>
          <div className="flex justify-center">
            <TRSpinner uiSize="md" />
          </div>
        </MinimalLayout>
      );
    }

    // Fallback: show a link to login.
    return (
      <MinimalLayout>
        <Alert className="mb-4" icon={CircleAlertIcon} type="warning">
          {t('error.sessionExpired')}
        </Alert>
        <TRLinkButton
          className="w-full font-semibold"
          intent="primary"
          render={<a href="/login" />}
        >
          {t('error.goToLogin')}
        </TRLinkButton>
      </MinimalLayout>
    );
  }

  // --- Generic error ---
  const errorCode =
    error instanceof TinyAuthError ? error.code : 'UNKNOWN_ERROR';
  const errorMessage =
    error instanceof TinyAuthError ? error.message : t('error.defaultMessage');

  return (
    <MinimalLayout>
      <Alert className="mb-4" icon={CircleAlertIcon} type="error">
        {t('error.title')}
      </Alert>

      <h1 className="mb-0 text-center font-bold text-tinyrack-2xl text-tinyrack-text">
        {t('error.subtitle')}
      </h1>
      <p className="mb-6 text-center text-tinyrack-lg text-tinyrack-text-muted">
        {errorMessage}
      </p>

      {/* Error code */}
      <div className="mb-6 rounded-tinyrack-md bg-tinyrack-surface-muted p-4 text-center">
        <p className="mb-1 text-tinyrack-text-muted text-tinyrack-xs">
          {t('error.codeLabel')}
        </p>
        <code
          className="font-mono text-tinyrack-danger text-tinyrack-sm"
          data-testid="error-code"
        >
          {errorCode}
        </code>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <TRButton
          className="w-full font-semibold"
          intent="primary"
          onClick={reset}
          type="button"
        >
          {t('error.retry')}
        </TRButton>
        <TRButton
          appearance="ghost"
          className="w-full font-semibold"
          intent="neutral"
          onClick={() => window.history.back()}
          type="button"
        >
          {t('error.goBack')}
        </TRButton>
      </div>
    </MinimalLayout>
  );
}
