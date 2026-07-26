import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
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
import { verifyRecoveryCodeMutationOptions } from '#frontend/queries/totp.ts';

/** Error codes from backend */
const ERROR_CODES = {
  SECOND_FACTOR_SESSION_EXPIRED: 'SECOND_FACTOR_SESSION_EXPIRED',
  INVALID_RECOVERY_CODE: 'INVALID_RECOVERY_CODE',
  NO_RECOVERY_CODES_AVAILABLE: 'NO_RECOVERY_CODES_AVAILABLE',
  TOTP_NOT_ENABLED: 'TOTP_NOT_ENABLED',
} as const;

const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/verify/totp/recovery/')({
  component: VerifyRecovery,
  validateSearch: SearchSchema,
});

type RecoveryFormValues = {
  code: string;
};

/** Auto redirect countdown seconds */
const REDIRECT_COUNTDOWN_SECONDS = 5;

function VerifyRecovery() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [sessionExpired, setSessionExpired] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(
    REDIRECT_COUNTDOWN_SECONDS,
  );

  const recoverySchema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .transform((value) => value.toUpperCase())
          .pipe(
            z
              .string()
              .regex(
                /^[A-HJ-NP-TV-Z2-9]{4}(?:-[A-HJ-NP-TV-Z2-9]{4}){3}$/,
                t('verifyRecovery.error.invalid'),
              ),
          ),
      }),
    [t],
  );

  const verifyMutation = useMutation({
    ...verifyRecoveryCodeMutationOptions,
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
    register,
    setError,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RecoveryFormValues>({
    defaultValues: {
      code: '',
    },
    resolver: standardSchemaResolver(recoverySchema),
  });

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

  const onSubmit = async (values: RecoveryFormValues) => {
    try {
      await verifyMutation.mutateAsync(values);
    } catch (error) {
      if (error instanceof TinyAuthError) {
        switch (error.code) {
          case ERROR_CODES.SECOND_FACTOR_SESSION_EXPIRED:
            setSessionExpired(true);
            setRedirectCountdown(REDIRECT_COUNTDOWN_SECONDS);
            return;

          case ERROR_CODES.TOTP_NOT_ENABLED:
            redirectToLogin();
            return;

          case ERROR_CODES.NO_RECOVERY_CODES_AVAILABLE:
            setError('code', {
              type: 'manual',
              message: t('verifyRecovery.error.noCodesAvailable'),
            });
            setValue('code', '');
            inputRef.current?.focus();
            return;

          case ERROR_CODES.INVALID_RECOVERY_CODE:
            setError('code', {
              type: 'manual',
              message: t('verifyRecovery.error.invalid'),
            });
            setValue('code', '');
            inputRef.current?.focus();
            return;
        }
      }

      // Generic error fallback
      setError('code', {
        type: 'manual',
        message: t('verifyRecovery.error.invalid'),
      });
      setValue('code', '');
      inputRef.current?.focus();
    }
  };

  const { ref: formRef, ...registerRest } = register('code');

  return (
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('verifyRecovery.subtitle')}
        title={t('verifyRecovery.title')}
      />

      {sessionExpired && (
        <Alert
          data-testid="recovery-session-expired"
          icon={CircleAlertIcon}
          type="warning"
        >
          <span className="flex flex-col items-start gap-tinyrack-3xs">
            <span>{t('verifyRecovery.error.expired')}</span>
            <span className="text-tinyrack-sm opacity-80">
              {t('verifyRecovery.redirecting', {
                seconds: redirectCountdown,
              })}
            </span>
            <TRButton
              appearance="ghost"
              intent="neutral"
              onClick={redirectToLogin}
              type="button"
              uiSize="sm"
            >
              {t('verifyRecovery.redirectNow')}
            </TRButton>
          </span>
        </Alert>
      )}

      <form
        className="flex flex-col gap-tinyrack-lg"
        onSubmit={handleSubmit(onSubmit)}
      >
        <TRField.Root uiSize="md">
          <TRInput
            {...registerRest}
            autoComplete="off"
            className="w-full text-center font-mono"
            data-testid="recovery-code-input"
            disabled={sessionExpired}
            placeholder={t('verifyRecovery.placeholder')}
            ref={(el) => {
              formRef(el);
              inputRef.current = el as HTMLInputElement | null;
            }}
            type="text"
          />
          {errors.code && (
            <div className="tr-field-error" data-testid="recovery-error">
              {errors.code.message}
            </div>
          )}
        </TRField.Root>

        {sessionExpired ? (
          <TRButton
            className="w-full"
            disabled
            intent="primary"
            type="button"
            uiSize="lg"
          >
            {t('verifyRecovery.submit')}
          </TRButton>
        ) : (
          <TRButton
            className="w-full"
            intent="primary"
            loading={verifyMutation.isPending}
            loadingLabel={t('verifyRecovery.submitting')}
            type="submit"
            uiSize="lg"
          >
            {t('verifyRecovery.submit')}
          </TRButton>
        )}
      </form>

      {/* Mirrors /verify/totp: the other second factor sits below the rule. */}
      <div className="flex flex-col gap-tinyrack-md">
        <LabeledSeparator label={t('common.or')} />
        <TRButton
          appearance="ghost"
          className="w-full"
          data-testid="recovery-back-to-totp"
          intent="neutral"
          onClick={() =>
            router.navigate({
              to: '/verify/totp',
              search: extractOAuthParams(search),
            })
          }
          type="button"
        >
          {t('verifyRecovery.backToTotp')}
        </TRButton>
      </div>

      <AuthFooter>
        <AuthFooterLink
          link={
            <Link search={extractOAuthParams(search)} to="/login">
              {t('verifyRecovery.backToLogin')}
            </Link>
          }
        />
      </AuthFooter>
    </AuthLayout>
  );
}
