import { WarningCircleIcon } from '@phosphor-icons/react';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
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
    <div className="flex min-h-screen flex-col bg-surface p-4">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-100 rounded-xl border border-surface-elevated bg-surface-elevated p-12 shadow-lg">
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
        <Alert className="mb-4" icon={WarningCircleIcon} type="warning">
          {t('error.sessionExpired')}
        </Alert>
        <a
          className="tr-btn tr-btn-primary w-full font-semibold text-[14px]"
          href="/login"
        >
          {t('error.goToLogin')}
        </a>
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
      <Alert className="mb-4" icon={WarningCircleIcon} type="error">
        {t('error.title')}
      </Alert>

      <h1 className="mb-0 text-center font-bold text-2xl">
        {t('error.subtitle')}
      </h1>
      <p className="mb-6 text-center text-lg text-muted-foreground">
        {errorMessage}
      </p>

      {/* Error code */}
      <div className="mb-6 rounded-lg bg-surface p-4 text-center">
        <p className="mb-1 text-muted-foreground/50 text-xs">
          {t('error.codeLabel')}
        </p>
        <code
          className="font-mono text-danger text-sm"
          data-testid="error-code"
        >
          {errorCode}
        </code>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <TRButton
          className="w-full font-semibold text-[14px]"
          intent="primary"
          onClick={reset}
          type="button"
        >
          {t('error.retry')}
        </TRButton>
        <TRButton
          appearance="ghost"
          className="w-full font-semibold text-[14px]"
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
