import {
  InfoIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FooterLink } from '@/components/auth/footer-link.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { QrStep } from '@/components/totp/qr-step.js';
import { RecoveryCodesStep } from '@/components/totp/recovery-codes-step.js';
import { useTotpSetup } from '@/components/totp/use-totp-setup.js';
import { VerifyStep } from '@/components/totp/verify-step.js';
import { Alert } from '@/components/ui/alert.js';
import { PageLayout } from '@/components/ui/page-layout.js';
import { ApiError } from '@/libs/error.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { getSessionQueryOptions } from '@/queries/session.js';
import type {
  TotpConfirmResponse,
  TotpSetupVerifyResponse,
} from '@/queries/totp.js';

/** Error codes from backend */
const ERROR_CODES = {
  TOTP_ALREADY_ENABLED: 'TOTP_ALREADY_ENABLED',
  TOTP_NOT_SETUP: 'TOTP_NOT_SETUP',
  INVALID_TOTP_CODE: 'INVALID_TOTP_CODE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  SECOND_FACTOR_SESSION_EXPIRED: 'SECOND_FACTOR_SESSION_EXPIRED',
} as const;

export const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/setup/totp/')({
  component: SetupTotp,
  validateSearch: SearchSchema,
});

type ErrorType = 'generic' | 'already_enabled' | 'session_expired';

/** Auto redirect countdown seconds */
const REDIRECT_COUNTDOWN_SECONDS = 5;

function SetupTotp() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const [errorType, setErrorType] = useState<ErrorType>('generic');
  const [redirectCountdown, setRedirectCountdown] = useState(
    REDIRECT_COUNTDOWN_SECONDS,
  );

  const redirectToLogin = useCallback(() => {
    router.navigate({
      to: '/login',
      search: extractOAuthParams(search),
    });
  }, [router, search]);

  const redirectToProfile = useCallback(() => {
    router.navigate({ to: '/profile' });
  }, [router]);

  const handleSetupError = useCallback((error: Error) => {
    if (error instanceof ApiError) {
      switch (error.code) {
        case ERROR_CODES.TOTP_ALREADY_ENABLED:
          setErrorType('already_enabled');
          break;
        case ERROR_CODES.UNAUTHORIZED:
        case ERROR_CODES.SECOND_FACTOR_SESSION_EXPIRED:
          setErrorType('session_expired');
          setRedirectCountdown(REDIRECT_COUNTDOWN_SECONDS);
          break;
        default:
          setErrorType('generic');
      }
    } else {
      setErrorType('generic');
    }
  }, []);

  const handleVerifySuccess = useCallback(
    async (_data: TotpSetupVerifyResponse) => {
      // Recovery codes step is handled by useTotpSetup hook
      // (step transitions to 'recovery' automatically)
      // Session update happens after confirm, not here
      await tick();
    },
    [],
  );

  const handleConfirmSuccess = useCallback(
    async (data: TotpConfirmResponse) => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: data.user,
      });
      await tick();
      // Navigate after successful confirm
      if (isOAuthFlow(search)) {
        window.location.href = buildAuthorizeUrl(search);
      } else {
        router.navigate({ to: '/profile' });
      }
    },
    [queryClient, router, search],
  );

  const {
    step,
    setupData,
    recoveryCodes,
    isSetupPending,
    isVerifyPending,
    isConfirmPending,
    startSetup,
    verify,
    goToQr,
    goToVerify,
    confirmRecoveryCodes,
  } = useTotpSetup({
    autoStart: true,
    onSetupError: handleSetupError,
    onVerifySuccess: handleVerifySuccess,
    onConfirmSuccess: handleConfirmSuccess,
    onVerifyError: (error) => {
      if (error instanceof ApiError) {
        switch (error.code) {
          case ERROR_CODES.TOTP_ALREADY_ENABLED:
            redirectToProfile();
            break;
          case ERROR_CODES.UNAUTHORIZED:
          case ERROR_CODES.SECOND_FACTOR_SESSION_EXPIRED:
            setErrorType('session_expired');
            setRedirectCountdown(REDIRECT_COUNTDOWN_SECONDS);
            break;
          case ERROR_CODES.TOTP_NOT_SETUP:
            startSetup();
            break;
        }
      }
    },
  });

  // Auto redirect when session expires
  useEffect(() => {
    if (errorType !== 'session_expired' || step !== 'error') return;

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          redirectToLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [errorType, step, redirectToLogin]);

  const handleVerify = useCallback(
    async (code: string) => {
      await verify(code);
    },
    [verify],
  );

  // Loading state
  if (step === 'loading') {
    return (
      <PageLayout maxWidth="100" cardPadding>
        <PageHeader
          title={t('setupTotp.title')}
          subtitle={t('setupTotp.subtitle')}
        />
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (step === 'error') {
    // Session expired error - show countdown and redirect
    if (errorType === 'session_expired') {
      return (
        <PageLayout maxWidth="100" cardPadding>
          <PageHeader
            title={t('setupTotp.title')}
            subtitle={t('setupTotp.subtitle')}
          />
          <div className="alert alert-warning mb-4">
            <WarningCircleIcon className="size-5" weight="fill" />
            <div className="flex flex-col gap-1">
              <span>{t('setupTotp.error.expired')}</span>
              <span className="text-sm opacity-80">
                {t('setupTotp.redirecting', {
                  seconds: redirectCountdown,
                })}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-ghost mt-2 w-fit"
                onClick={redirectToLogin}
              >
                {t('setupTotp.redirectNow')}
              </button>
            </div>
          </div>
          <FooterLink
            text=""
            linkText={t('setupTotp.backToLogin')}
            to="/login"
            search={extractOAuthParams(search)}
          />
        </PageLayout>
      );
    }

    // TOTP already enabled error - redirect to profile
    if (errorType === 'already_enabled') {
      return (
        <PageLayout maxWidth="100" cardPadding>
          <PageHeader
            title={t('setupTotp.title')}
            subtitle={t('setupTotp.subtitle')}
          />
          <Alert type="info" icon={InfoIcon} className="mb-4">
            {t('setupTotp.error.alreadyEnabled')}
          </Alert>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={redirectToProfile}
          >
            {t('setupTotp.goToProfile')}
          </button>
          <FooterLink
            text=""
            linkText={t('setupTotp.backToLogin')}
            to="/login"
            search={extractOAuthParams(search)}
          />
        </PageLayout>
      );
    }

    // Generic error - show retry button
    return (
      <PageLayout maxWidth="100" cardPadding>
        <PageHeader
          title={t('setupTotp.title')}
          subtitle={t('setupTotp.subtitle')}
        />
        <Alert type="error" icon={XCircleIcon} className="mb-4">
          {t('setupTotp.error.setupFailed')}
        </Alert>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={startSetup}
          disabled={isSetupPending}
        >
          {t('setupTotp.retry')}
        </button>
        <FooterLink
          text=""
          linkText={t('setupTotp.backToLogin')}
          to="/login"
          search={extractOAuthParams(search)}
        />
      </PageLayout>
    );
  }

  // Recovery codes step
  if (step === 'recovery' && recoveryCodes.length > 0) {
    return (
      <PageLayout maxWidth="100" cardPadding>
        <PageHeader
          title={t('setupTotp.recoveryCodes.title')}
          subtitle={t('setupTotp.subtitle')}
        />
        <RecoveryCodesStep
          recoveryCodes={recoveryCodes}
          onConfirm={confirmRecoveryCodes}
          isLoading={isConfirmPending}
          data-testid="setup-totp-recovery"
        />
      </PageLayout>
    );
  }

  // QR code step
  if (step === 'qr' && setupData) {
    return (
      <PageLayout maxWidth="100" cardPadding>
        <PageHeader
          title={t('setupTotp.title')}
          subtitle={t('setupTotp.subtitle')}
        />

        <div className="alert alert-info mb-4">
          <ShieldCheckIcon className="size-5" weight="fill" />
          <span>{t('setupTotp.required')}</span>
        </div>

        <QrStep
          setupData={setupData}
          onNext={goToVerify}
          data-testid="setup-totp-qr"
        />

        <FooterLink
          text=""
          linkText={t('setupTotp.backToLogin')}
          to="/login"
          search={extractOAuthParams(search)}
          data-testid="setup-totp-login-link"
        />
      </PageLayout>
    );
  }

  // Verify step
  return (
    <PageLayout maxWidth="100" cardPadding>
      <PageHeader
        title={t('setupTotp.verifyTitle')}
        subtitle={t('setupTotp.verifySubtitle')}
      />

      <VerifyStep
        onSubmit={handleVerify}
        onBack={goToQr}
        isPending={isVerifyPending}
        data-testid="setup-totp-verify"
      />
    </PageLayout>
  );
}
