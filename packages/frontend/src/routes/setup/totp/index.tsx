import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { FooterLink } from '@/components/auth/footer-link.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { Alert } from '@/components/ui/alert.js';
import { PinInput, type PinInputRef } from '@/components/ui/pin-input.js';
import { ApiError } from '@/libs/error.js';
import {
  OAuthSearchSchema,
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { getSessionQueryOptions } from '@/queries/session.js';
import {
  type TotpSetupResponse,
  startTotpSetupMutationOptions,
  verifyTotpMutationOptions,
} from '@/queries/totp.js';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  InfoIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';

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

type SetupStep = 'loading' | 'qr' | 'verify' | 'error';

type VerifyFormValues = {
  code: string;
};

type ErrorType = 'generic' | 'already_enabled' | 'session_expired';

/** Auto redirect countdown seconds */
const REDIRECT_COUNTDOWN_SECONDS = 5;

function SetupTotp() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const [step, setStep] = useState<SetupStep>('loading');
  const [setupData, setSetupData] = useState<TotpSetupResponse | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>('generic');
  const [redirectCountdown, setRedirectCountdown] = useState(
    REDIRECT_COUNTDOWN_SECONDS,
  );
  const setupInitiatedRef = useRef(false);
  const pinInputRef = useRef<PinInputRef>(null);

  const verifySchema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .length(6, t('validation.totp.length'))
          .regex(/^\d{6}$/, t('validation.totp.digits')),
      }),
    [t],
  );

  const {
    setValue,
    setError,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<VerifyFormValues>({
    defaultValues: { code: '' },
    resolver: standardSchemaResolver(verifySchema),
  });

  const codeValue = watch('code');

  const redirectToLogin = useCallback(() => {
    router.navigate({
      to: '/login',
      search: extractOAuthParams(search),
    });
  }, [router, search]);

  const redirectToProfile = useCallback(() => {
    router.navigate({ to: '/profile' });
  }, [router]);

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

  const setupMutation = useMutation({
    ...startTotpSetupMutationOptions,
    onSuccess: (data) => {
      setSetupData(data);
      setStep('qr');
    },
    onError: (error) => {
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
      setStep('error');
    },
  });

  const verifyMutation = useMutation({
    ...verifyTotpMutationOptions,
    onSuccess: async (data) => {
      if (data.user) {
        queryClient.setQueryData(getSessionQueryOptions.queryKey, {
          user: data.user,
        });
        await tick();

        if (isOAuthFlow(search)) {
          window.location.href = buildAuthorizeUrl(search);
        } else {
          router.navigate({ to: '/profile' });
        }
      } else {
        queryClient.invalidateQueries({
          queryKey: getSessionQueryOptions.queryKey,
        });
        router.navigate({ to: '/profile' });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const startSetup = useCallback(() => {
    setupInitiatedRef.current = true;
    setStep('loading');
    setErrorType('generic');
    setupMutation.mutate();
  }, [setupMutation]);

  // Start setup on mount
  useEffect(() => {
    if (!setupInitiatedRef.current && step === 'loading') {
      setupInitiatedRef.current = true;
      setupMutation.mutate();
    }
  }, [step, setupMutation]);

  const onSubmit = async (values: VerifyFormValues) => {
    try {
      await verifyMutation.mutateAsync(values);
    } catch (error) {
      if (error instanceof ApiError) {
        switch (error.code) {
          case ERROR_CODES.TOTP_ALREADY_ENABLED:
            // Already enabled - redirect to profile
            redirectToProfile();
            return;

          case ERROR_CODES.UNAUTHORIZED:
          case ERROR_CODES.SECOND_FACTOR_SESSION_EXPIRED:
            // Session expired - show error state
            setErrorType('session_expired');
            setRedirectCountdown(REDIRECT_COUNTDOWN_SECONDS);
            setStep('error');
            return;

          case ERROR_CODES.TOTP_NOT_SETUP:
            // Setup not started - restart
            startSetup();
            return;

          default:
            setError('code', {
              type: 'manual',
              message: t('setupTotp.error.invalid'),
            });
            setValue('code', '');
            pinInputRef.current?.focus();
        }
      } else {
        setError('code', {
          type: 'manual',
          message: t('setupTotp.error.invalid'),
        });
        setValue('code', '');
        pinInputRef.current?.focus();
      }
    }
  };

  // Loading state
  if (step === 'loading') {
    return (
      <AuthPageLayout>
        <PageHeader
          title={t('setupTotp.title')}
          subtitle={t('setupTotp.subtitle')}
        />
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </AuthPageLayout>
    );
  }

  // Error state
  if (step === 'error') {
    // Session expired error - show countdown and redirect
    if (errorType === 'session_expired') {
      return (
        <AuthPageLayout>
          <PageHeader
            title={t('setupTotp.title')}
            subtitle={t('setupTotp.subtitle')}
          />
          <div className="alert alert-warning mb-4">
            <WarningCircleIcon className="size-5" weight="fill" />
            <div className="flex flex-col gap-1">
              <span>{t('setupTotp.error.expired')}</span>
              <span className="text-sm opacity-80">
                {t('setupTotp.redirecting', { seconds: redirectCountdown })}
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
        </AuthPageLayout>
      );
    }

    // TOTP already enabled error - redirect to profile
    if (errorType === 'already_enabled') {
      return (
        <AuthPageLayout>
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
        </AuthPageLayout>
      );
    }

    // Generic error - show retry button
    return (
      <AuthPageLayout>
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
        >
          {t('setupTotp.retry')}
        </button>
        <FooterLink
          text=""
          linkText={t('setupTotp.backToLogin')}
          to="/login"
          search={extractOAuthParams(search)}
        />
      </AuthPageLayout>
    );
  }

  // QR code step
  if (step === 'qr' && setupData) {
    return (
      <AuthPageLayout>
        <PageHeader
          title={t('setupTotp.title')}
          subtitle={t('setupTotp.subtitle')}
        />

        <div className="alert alert-info mb-4">
          <ShieldCheckIcon className="size-5" weight="fill" />
          <span>{t('setupTotp.required')}</span>
        </div>

        <p className="mb-4 text-center text-base-content/60 text-sm">
          {t('setupTotp.qrDescription')}
        </p>

        <div className="mb-4 flex justify-center">
          <img
            src={setupData.qr_code}
            alt="TOTP QR Code"
            className="h-48 w-48 rounded-lg border"
          />
        </div>

        <div className="collapse-arrow collapse mb-4 bg-base-200">
          <input type="checkbox" />
          <div className="collapse-title font-medium text-sm">
            {t('setupTotp.manualEntry')}
          </div>
          <div className="collapse-content">
            <code className="block break-all rounded bg-base-300 p-2 text-xs">
              {setupData.secret}
            </code>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => setStep('verify')}
        >
          {t('setupTotp.next')}
        </button>

        <FooterLink
          text=""
          linkText={t('setupTotp.backToLogin')}
          to="/login"
          search={extractOAuthParams(search)}
        />
      </AuthPageLayout>
    );
  }

  // Verify step
  return (
    <AuthPageLayout>
      <PageHeader
        title={t('setupTotp.verifyTitle')}
        subtitle={t('setupTotp.verifySubtitle')}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <PinInput
          ref={pinInputRef}
          length={6}
          value={codeValue}
          onChange={(value) => setValue('code', value)}
          onComplete={() => handleSubmit(onSubmit)()}
          error={errors.code}
          autoFocus
        />

        <SubmitButton
          isPending={verifyMutation.isPending}
          pendingText={t('setupTotp.verifying')}
          className="mt-2"
        >
          {t('setupTotp.verify')}
        </SubmitButton>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setStep('qr')}
        >
          {t('setupTotp.back')}
        </button>
      </div>
    </AuthPageLayout>
  );
}
