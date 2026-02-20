import { TinyAuthError } from '@frontend/libs/error.js';
import { WarningCircleIcon } from '@phosphor-icons/react';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Minimal error layout that does NOT depend on any queries.
 *
 * Unlike `PageLayout`, this component never calls
 * `useSuspenseQuery` so it is safe to render even when
 * the network or session is broken.
 */
function MinimalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-base-200 p-4">
      <div className="flex flex-1 items-center justify-center">
        <div className="card w-full max-w-100 border border-base-200 bg-base-100 p-12 shadow-lg">
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
            <span className="loading loading-spinner loading-md" />
          </div>
        </MinimalLayout>
      );
    }

    // Fallback: show a link to login.
    return (
      <MinimalLayout>
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-warning">
          <WarningCircleIcon className="size-5 shrink-0" weight="fill" />
          <span className="text-sm">{t('error.sessionExpired')}</span>
        </div>
        <a
          className="btn btn-primary btn-block h-10 font-semibold text-[14px]"
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
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-error/10 p-3 text-error">
        <WarningCircleIcon className="size-5 shrink-0" weight="fill" />
        <span className="text-sm">{t('error.title')}</span>
      </div>

      <h1 className="mb-0 text-center font-bold text-2xl">
        {t('error.subtitle')}
      </h1>
      <p className="mb-6 text-center text-base-content/60 text-lg">
        {errorMessage}
      </p>

      {/* Error code */}
      <div className="mb-6 rounded-lg bg-base-200 p-4 text-center">
        <p className="mb-1 text-base-content/50 text-xs">
          {t('error.codeLabel')}
        </p>
        <code className="font-mono text-error text-sm">{errorCode}</code>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          className="btn btn-primary btn-block h-10 font-semibold text-[14px]"
          onClick={reset}
          type="button"
        >
          {t('error.retry')}
        </button>
        <button
          className="btn btn-ghost btn-block h-10 font-semibold text-[14px]"
          onClick={() => window.history.back()}
          type="button"
        >
          {t('error.goBack')}
        </button>
      </div>
    </MinimalLayout>
  );
}
