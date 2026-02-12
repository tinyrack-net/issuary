import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { WarningCircleIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { FooterLink } from '@/components/auth/footer-link.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { PageLayout } from '@/components/ui/page-layout.js';
import { PinInput, type PinInputRef } from '@/components/ui/pin-input.js';
import { ApiError } from '@/libs/error.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { getSessionQueryOptions } from '@/queries/session.js';
import { verifyTotpLoginMutationOptions } from '@/queries/totp.js';

/** Error codes from backend */
const ERROR_CODES = {
  SECOND_FACTOR_SESSION_EXPIRED: 'SECOND_FACTOR_SESSION_EXPIRED',
  INVALID_TOTP_CODE: 'INVALID_TOTP_CODE',
  TOTP_NOT_ENABLED: 'TOTP_NOT_ENABLED',
} as const;

export const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/verify/totp/')({
  component: VerifyTotp,
  validateSearch: SearchSchema,
});

type VerifyTotpFormValues = {
  code: string;
};

/** Auto redirect countdown seconds */
const REDIRECT_COUNTDOWN_SECONDS = 5;

function VerifyTotp() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const pinInputRef = useRef<PinInputRef>(null);

  const [sessionExpired, setSessionExpired] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(
    REDIRECT_COUNTDOWN_SECONDS,
  );

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

  const verifyMutation = useMutation({
    ...verifyTotpLoginMutationOptions,
    onSuccess: async (data) => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: data.user,
      });
      await tick();

      if (isOAuthFlow(search)) {
        window.location.href = buildAuthorizeUrl(search);
      } else {
        router.navigate({ to: '/profile' });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const {
    setValue,
    setError,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<VerifyTotpFormValues>({
    defaultValues: {
      code: '',
    },
    resolver: standardSchemaResolver(verifySchema),
  });

  const codeValue = watch('code');

  // Auto redirect when session expires
  const redirectToLogin = useCallback(() => {
    router.navigate({
      to: '/login',
      search: extractOAuthParams(search),
    });
  }, [router, search]);

  useEffect(() => {
    if (!sessionExpired) return;

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
  }, [sessionExpired, redirectToLogin]);

  const onSubmit = async (values: VerifyTotpFormValues) => {
    try {
      await verifyMutation.mutateAsync(values);
    } catch (error) {
      if (error instanceof ApiError) {
        switch (error.code) {
          case ERROR_CODES.SECOND_FACTOR_SESSION_EXPIRED:
            // Session expired - show alert and start auto redirect
            setSessionExpired(true);
            setRedirectCountdown(REDIRECT_COUNTDOWN_SECONDS);
            return;

          case ERROR_CODES.TOTP_NOT_ENABLED:
            // TOTP not enabled - redirect to login
            redirectToLogin();
            return;

          case ERROR_CODES.INVALID_TOTP_CODE:
            // Invalid code - show specific error and clear input
            setError('code', {
              type: 'manual',
              message: t('verifyTotp.error.invalid'),
            });
            setValue('code', '');
            pinInputRef.current?.focus();
            return;
        }
      }

      // Generic error fallback
      setError('code', {
        type: 'manual',
        message: t('verifyTotp.error.invalid'),
      });
      setValue('code', '');
      pinInputRef.current?.focus();
    }
  };

  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('verifyTotp.subtitle')}
        title={t('verifyTotp.title')}
      />

      {sessionExpired && (
        <div
          className="alert alert-warning mb-4"
          data-testid="verify-totp-expired-alert"
        >
          <WarningCircleIcon className="size-5" weight="fill" />
          <div className="flex flex-col gap-1">
            <span>{t('verifyTotp.error.expired')}</span>
            <span className="text-sm opacity-80">
              {t('verifyTotp.redirecting', { seconds: redirectCountdown })}
            </span>
            <button
              className="btn btn-sm btn-ghost mt-2 w-fit"
              data-testid="verify-totp-redirect-btn"
              onClick={redirectToLogin}
              type="button"
            >
              {t('verifyTotp.redirectNow')}
            </button>
          </div>
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <PinInput
          autoFocus
          data-testid="verify-totp-pin"
          disabled={sessionExpired}
          error={errors.code}
          length={6}
          onChange={(value) => setValue('code', value)}
          onComplete={() => handleSubmit(onSubmit)()}
          ref={pinInputRef}
          value={codeValue}
        />

        {sessionExpired ? (
          <button
            className="btn btn-block btn-disabled mt-2"
            disabled
            type="button"
          >
            {t('verifyTotp.submit')}
          </button>
        ) : (
          <SubmitButton
            className="mt-2"
            data-testid="verify-totp-submit-btn"
            isPending={verifyMutation.isPending}
            pendingText={t('verifyTotp.submitting')}
          >
            {t('verifyTotp.submit')}
          </SubmitButton>
        )}
      </form>

      <div className="mt-4 text-center">
        <button
          className="link link-info font-medium text-xs"
          data-testid="verify-totp-recovery-link"
          onClick={() =>
            router.navigate({
              to: '/verify/totp/recovery',
              search: extractOAuthParams(search),
            })
          }
          type="button"
        >
          {t('verifyTotp.useRecoveryCode')}
        </button>
      </div>

      <FooterLink
        data-testid="verify-totp-login-link"
        linkText={t('verifyTotp.backToLogin')}
        search={extractOAuthParams(search)}
        text=""
        to="/login"
      />
    </PageLayout>
  );
}
