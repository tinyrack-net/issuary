import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { CircleAlertIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { LabeledSeparator } from '#frontend/components/ui/labeled-separator.tsx';
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
          data-testid="totp-verify-session-expired"
          icon={CircleAlertIcon}
          type="warning"
        >
          <span className="flex flex-col items-start gap-tinyrack-3xs">
            <span>{t('verifyTotp.error.expired')}</span>
            <span className="text-tinyrack-sm opacity-tinyrack-hover">
              {t('verifyTotp.redirecting', { seconds: redirectCountdown })}
            </span>
            <TRButton
              appearance="ghost"
              intent="neutral"
              onClick={redirectToLogin}
              type="button"
              uiSize="sm"
            >
              {t('verifyTotp.redirectNow')}
            </TRButton>
          </span>
        </Alert>
      )}

      <form
        className="flex flex-col gap-tinyrack-lg"
        onSubmit={handleSubmit(onSubmit)}
      >
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
            className="w-full"
            disabled
            intent="primary"
            type="button"
            uiSize="lg"
          >
            {t('verifyTotp.submit')}
          </TRButton>
        ) : (
          <TRButton
            className="w-full"
            intent="primary"
            loading={verifyMutation.isPending}
            loadingLabel={t('verifyTotp.submitting')}
            type="submit"
            uiSize="lg"
          >
            {t('verifyTotp.submit')}
          </TRButton>
        )}
      </form>

      {/*
        The recovery code is the way out when the authenticator is gone, so it
        sits below the rule rather than in the footer with the navigation.
      */}
      <div className="flex flex-col gap-tinyrack-md">
        <LabeledSeparator label={t('common.or')} />
        <TRButton
          appearance="ghost"
          className="w-full"
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

      <AuthFooter>
        <AuthFooterLink
          link={
            <Link search={extractOAuthParams(search)} to="/login">
              {t('verifyTotp.backToLogin')}
            </Link>
          }
        />
      </AuthFooter>
    </AuthLayout>
  );
}
