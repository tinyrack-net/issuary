import { useQueryClient } from '@tanstack/react-query';
import { TRAlert } from '@tinyrack/ui/components/alert';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import {
  CircleAlertIcon,
  CircleXIcon,
  InfoIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { AuthSteps } from '#frontend/components/auth/auth-steps.tsx';
import { QrStep } from '#frontend/components/totp/qr-step.tsx';
import { RecoveryCodesStep } from '#frontend/components/totp/recovery-codes-step.tsx';
import { VerifyStep } from '#frontend/components/totp/verify-step.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import { useTotpSetup } from '#frontend/features/totp/use-totp-setup.ts';
import { navigateDocument } from '#frontend/libs/document-navigation.ts';
import { IssuaryError } from '#frontend/libs/error.ts';
import {
  buildAuthenticatedAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '#frontend/libs/oauth-search.ts';
import { tick } from '#frontend/libs/promise.ts';
import {
  createRouteLoaderData,
  hrefWithSearch,
  parseRequestSearch,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import type {
  TotpConfirmResponse,
  TotpSetupVerifyResponse,
} from '#frontend/queries/totp.ts';

/** Error codes from backend */
const ERROR_CODES = {
  TOTP_ALREADY_ENABLED: 'TOTP_ALREADY_ENABLED',
  TOTP_NOT_SETUP: 'TOTP_NOT_SETUP',
  INVALID_TOTP_CODE: 'INVALID_TOTP_CODE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  SECOND_FACTOR_SESSION_EXPIRED: 'SECOND_FACTOR_SESSION_EXPIRED',
} as const;

const SearchSchema = OAuthSearchSchema;

import type { Route } from './+types/route.js';

type ErrorType = 'generic' | 'already_enabled' | 'session_expired';

/** Auto redirect countdown seconds */
const REDIRECT_COUNTDOWN_SECONDS = 5;

function SetupTotp({
  search,
}: {
  search: ReturnType<typeof SearchSchema.parse>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [errorType, setErrorType] = useState<ErrorType>('generic');
  const [redirectCountdown, setRedirectCountdown] = useState(
    REDIRECT_COUNTDOWN_SECONDS,
  );

  const redirectToLogin = useCallback(() => {
    navigate(hrefWithSearch('/login', extractOAuthParams(search)));
  }, [navigate, search]);

  const redirectToProfile = useCallback(() => {
    navigate('/profile');
  }, [navigate]);

  const handleSetupError = useCallback((error: Error) => {
    if (error instanceof IssuaryError) {
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
        navigateDocument(buildAuthenticatedAuthorizeUrl(search));
      } else {
        navigate('/profile');
      }
    },
    [navigate, queryClient, search],
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
      if (error instanceof IssuaryError) {
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

  const isRecoveryStep = step === 'recovery' && recoveryCodes.length > 0;
  const isQrStep = step === 'qr' && setupData !== null;
  // `loading` and `error` are not points on the journey, so the wizard's
  // progress is hidden there rather than showing a misleading step.
  const isWizardStep = step !== 'loading' && step !== 'error';

  let wizardIndex = 1;
  if (isRecoveryStep) {
    wizardIndex = 2;
  } else if (isQrStep) {
    wizardIndex = 0;
  }

  let title = t('setupTotp.title');
  let subtitle: string | undefined = t('setupTotp.subtitle');
  if (isRecoveryStep) {
    title = t('setupTotp.recoveryCodes.title');
  } else if (isWizardStep && !isQrStep) {
    title = t('setupTotp.verifyTitle');
    subtitle = t('setupTotp.verifySubtitle');
  }

  // Where the original screens offered a way out: the wizard's later steps
  // deliberately do not, so nobody leaves before saving their codes.
  const showFooter = step === 'error' || isQrStep;

  let body: React.ReactNode;
  if (step === 'loading') {
    body = (
      <div
        className="flex justify-center py-tinyrack-xl"
        data-testid="totp-setup-loading"
      >
        <TRSpinner uiSize="lg" variant="primary" />
      </div>
    );
  } else if (step === 'error' && errorType === 'session_expired') {
    body = (
      <TRAlert.Root data-testid="totp-setup-session-expired" variant="warning">
        <CircleAlertIcon aria-hidden className="size-tinyrack-xl" />
        <TRAlert.Title>{t('setupTotp.error.expired')}</TRAlert.Title>
        <TRAlert.Description>
          {t('setupTotp.redirecting', {
            seconds: redirectCountdown,
          })}
        </TRAlert.Description>
        <TRAlert.Actions>
          <TRButton
            appearance="ghost"
            intent="neutral"
            onClick={redirectToLogin}
            type="button"
            uiSize="sm"
          >
            {t('setupTotp.redirectNow')}
          </TRButton>
        </TRAlert.Actions>
      </TRAlert.Root>
    );
  } else if (step === 'error' && errorType === 'already_enabled') {
    body = (
      <>
        <Alert icon={InfoIcon} type="info">
          {t('setupTotp.error.alreadyEnabled')}
        </Alert>
        <TRButton
          className="w-full"
          intent="primary"
          onClick={redirectToProfile}
          type="button"
          uiSize="lg"
        >
          {t('setupTotp.goToProfile')}
        </TRButton>
      </>
    );
  } else if (step === 'error') {
    body = (
      <>
        <Alert icon={CircleXIcon} type="error">
          {t('setupTotp.error.setupFailed')}
        </Alert>
        <TRButton
          className="w-full"
          disabled={isSetupPending}
          intent="primary"
          loading={isSetupPending}
          onClick={startSetup}
          type="button"
          uiSize="lg"
        >
          {t('setupTotp.retry')}
        </TRButton>
      </>
    );
  } else if (isRecoveryStep) {
    body = (
      <RecoveryCodesStep
        isLoading={isConfirmPending}
        onConfirm={confirmRecoveryCodes}
        recoveryCodes={recoveryCodes}
      />
    );
  } else if (isQrStep && setupData) {
    body = (
      <>
        <Alert icon={ShieldCheckIcon} type="info">
          {t('setupTotp.required')}
        </Alert>
        <QrStep onNext={goToVerify} setupData={setupData} />
      </>
    );
  } else {
    body = (
      <VerifyStep
        isPending={isVerifyPending}
        onBack={goToQr}
        onSubmit={handleVerify}
      />
    );
  }

  /*
    One shell, one header. The seven `AuthLayout` blocks this replaced meant
    the header remounted on every transition, so the title flashed and the
    progress had nowhere to live.
  */
  return (
    <AuthLayout width={isRecoveryStep ? 'wide' : 'form'}>
      <AuthPageHeader
        eyebrow={
          isWizardStep ? (
            <AuthSteps
              current={wizardIndex}
              progressLabel={t('setupTotp.stepProgress', {
                current: wizardIndex + 1,
                total: 3,
              })}
              steps={[
                t('setupTotp.steps.scan'),
                t('setupTotp.steps.verify'),
                t('setupTotp.steps.saveCodes'),
              ]}
            />
          ) : undefined
        }
        subtitle={subtitle}
        title={title}
      />

      {/* Keyed so each step animates in rather than swapping in place. */}
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural animated step host; each step owns visible typography. */}
      <div className="auth-enter flex flex-col gap-tinyrack-lg" key={step}>
        {body}
      </div>

      {showFooter && (
        <AuthFooter>
          <AuthFooterLink
            link={
              <Link to={hrefWithSearch('/login', extractOAuthParams(search))}>
                {t('setupTotp.backToLogin')}
              </Link>
            }
          />
        </AuthFooter>
      )}
    </AuthLayout>
  );
}

export function loader({ request, context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  return createRouteLoaderData(
    runtime.queryClient,
    parseRequestSearch(request, SearchSchema),
  );
}

export default function SetupTotpRoute({ loaderData }: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <SetupTotp search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}
