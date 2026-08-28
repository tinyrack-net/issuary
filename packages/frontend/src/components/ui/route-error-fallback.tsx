import type { ErrorComponentProps } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCode } from '@tinyrack/ui/components/code';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { TRText } from '@tinyrack/ui/components/text';
import { CircleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthOutcome } from '#frontend/components/auth/auth-outcome.tsx';
import { IssuaryError } from '#frontend/libs/error.ts';

/**
 * Minimal error layout that does NOT depend on any queries.
 *
 * Unlike `AuthLayout`, this component never calls `useSuspenseQuery` — the
 * brand panel reads the deployment config, and this renders precisely when
 * such a query has failed. So it is a single centred column built straight
 * from tokens, safe to render even when the network or session is broken.
 */
function MinimalLayout({ children }: { children: React.ReactNode }) {
  return (
    /* tinyrack-check-ignore-next-line components/no-native-text -- Structural viewport layout; visible content is supplied by DS components. */
    <div className="flex min-h-dvh items-center justify-center bg-tinyrack-surface px-tinyrack-lg py-tinyrack-xl">
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural fallback content slot; callers use DS text and controls. */}
      <div className="flex w-full max-w-tinyrack-measure-xl flex-col gap-tinyrack-xl rounded-tinyrack-xl border border-tinyrack-border bg-tinyrack-surface p-tinyrack-xl">
        {children}
      </div>
    </div>
  );
}

/**
 * Check whether an error represents a 401 Unauthorized
 * response from the backend.
 */
function isUnauthorizedError(error: Error): boolean {
  return error instanceof IssuaryError && error.status === 401;
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
        <AuthOutcome
          description={t('error.sessionExpired')}
          icon={CircleAlertIcon}
          title={t('error.subtitle')}
          tone="danger"
        >
          <TRLinkButton
            className="w-full"
            intent="primary"
            render={<a href="/login" />}
            uiSize="lg"
          >
            {t('error.goToLogin')}
          </TRLinkButton>
        </AuthOutcome>
      </MinimalLayout>
    );
  }

  // --- Generic error ---
  const errorCode =
    error instanceof IssuaryError ? error.code : 'UNKNOWN_ERROR';
  const errorMessage =
    error instanceof IssuaryError ? error.message : t('error.defaultMessage');

  return (
    <MinimalLayout>
      <AuthOutcome
        description={errorMessage}
        icon={CircleAlertIcon}
        title={t('error.subtitle')}
        tone="danger"
      >
        {/*
          Mono on the code itself, not the label: a font utility on `TRText`
          loses to the component's own per-variant `font-family` rule, and only
          the identifier needs fixed-width anyway.
        */}
        <TRText color="muted" variant="caption">
          {t('error.codeLabel')}{' '}
          <TRCode data-testid="error-code">{errorCode}</TRCode>
        </TRText>

        <TRButton
          className="w-full"
          intent="primary"
          onClick={reset}
          type="button"
          uiSize="lg"
        >
          {t('error.retry')}
        </TRButton>
        <TRButton
          appearance="ghost"
          className="w-full"
          intent="neutral"
          onClick={() => window.history.back()}
          type="button"
          uiSize="lg"
        >
          {t('error.goBack')}
        </TRButton>
      </AuthOutcome>
    </MinimalLayout>
  );
}
