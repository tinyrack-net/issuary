import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { CircleAlertIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { FooterLink } from '#frontend/components/auth/footer-link.tsx';
import { SubmitButton } from '#frontend/components/auth/submit-button.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import {
  PinInput,
  type PinInputRef,
} from '#frontend/components/ui/pin-input.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import { TinyAuthError } from '#frontend/libs/error.ts';
import {
  buildAuthenticatedAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '#frontend/libs/oauth-search.ts';
import { tick } from '#frontend/libs/promise.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import { verifyTotpLoginMutationOptions } from '#frontend/queries/totp.ts';

/** Error codes from backend */
const ERROR_CODES = {
  SECOND_FACTOR_SESSION_EXPIRED: 'SECOND_FACTOR_SESSION_EXPIRED',
  INVALID_TOTP_CODE: 'INVALID_TOTP_CODE',
  TOTP_NOT_ENABLED: 'TOTP_NOT_ENABLED',
} as const;

const SearchSchema = OAuthSearchSchema;

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
        window.location.href = buildAuthenticatedAuthorizeUrl(search);
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
      if (error instanceof TinyAuthError) {
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
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('verifyTotp.subtitle')}
        title={t('verifyTotp.title')}
      />

      {sessionExpired && (
        <Alert
          className="mb-4"
          data-testid="totp-verify-session-expired"
          icon={CircleAlertIcon}
          type="warning"
        >
          <div className="flex flex-col gap-1">
            <span>{t('verifyTotp.error.expired')}</span>
            <span className="text-tinyrack-sm opacity-80">
              {t('verifyTotp.redirecting', { seconds: redirectCountdown })}
            </span>
            <TRButton
              appearance="ghost"
              className="mt-2 w-fit"
              intent="neutral"
              onClick={redirectToLogin}
              type="button"
            >
              {t('verifyTotp.redirectNow')}
            </TRButton>
          </div>
        </Alert>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <PinInput
          autoFocus
          disabled={sessionExpired}
          error={errors.code}
          length={6}
          onChange={(value) => setValue('code', value)}
          onComplete={() => handleSubmit(onSubmit)()}
          ref={pinInputRef}
          value={codeValue}
        />

        {sessionExpired ? (
          <TRButton
            className="mt-2 w-full"
            disabled
            intent="primary"
            type="button"
          >
            {t('verifyTotp.submit')}
          </TRButton>
        ) : (
          <SubmitButton
            className="mt-2"
            isPending={verifyMutation.isPending}
            pendingText={t('verifyTotp.submitting')}
          >
            {t('verifyTotp.submit')}
          </SubmitButton>
        )}
      </form>

      <div className="mt-4 text-center">
        <TRButton
          appearance="ghost"
          className="font-medium"
          data-testid="totp-verify-recovery-link"
          intent="neutral"
          onClick={() =>
            router.navigate({
              to: '/verify/totp/recovery',
              search: extractOAuthParams(search),
            })
          }
          type="button"
        >
          {t('verifyTotp.useRecoveryCode')}
        </TRButton>
      </div>

      <FooterLink
        as={Link}
        linkText={t('verifyTotp.backToLogin')}
        search={extractOAuthParams(search)}
        text=""
        to="/login"
      />
    </AuthLayout>
  );
}
