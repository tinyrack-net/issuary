import { FooterLink } from '@frontend/components/auth/footer-link.js';
import { PageHeader } from '@frontend/components/auth/page-header.js';
import { SubmitButton } from '@frontend/components/auth/submit-button.js';
import { PageLayout } from '@frontend/components/ui/page-layout.js';
import { TinyAuthError } from '@frontend/libs/error.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@frontend/libs/oauth-search.js';
import { tick } from '@frontend/libs/promise.js';
import { getSessionQueryOptions } from '@frontend/queries/session.js';
import { verifyRecoveryCodeMutationOptions } from '@frontend/queries/totp.js';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { WarningCircleIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

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
          .regex(
            /^[a-z0-9]{4}-[a-z0-9]{4}$/,
            t('verifyRecovery.error.invalid'),
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
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('verifyRecovery.subtitle')}
        title={t('verifyRecovery.title')}
      />

      {sessionExpired && (
        <div className="alert alert-warning mb-4">
          <WarningCircleIcon className="size-5" weight="fill" />
          <div className="flex flex-col gap-1">
            <span>{t('verifyRecovery.error.expired')}</span>
            <span className="text-sm opacity-80">
              {t('verifyRecovery.redirecting', {
                seconds: redirectCountdown,
              })}
            </span>
            <button
              className="btn btn-sm btn-ghost mt-2 w-fit"
              onClick={redirectToLogin}
              type="button"
            >
              {t('verifyRecovery.redirectNow')}
            </button>
          </div>
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <fieldset className="fieldset">
          <input
            {...registerRest}
            autoComplete="off"
            className={`input input-bordered w-full text-center font-mono ${
              errors.code ? 'input-error' : ''
            }`}
            disabled={sessionExpired}
            placeholder={t('verifyRecovery.placeholder')}
            ref={(el) => {
              formRef(el);
              inputRef.current = el;
            }}
            type="text"
          />
          {errors.code && (
            <p className="fieldset-label text-error">{errors.code.message}</p>
          )}
        </fieldset>

        {sessionExpired ? (
          <button
            className="btn btn-block btn-disabled mt-2"
            disabled
            type="button"
          >
            {t('verifyRecovery.submit')}
          </button>
        ) : (
          <SubmitButton
            className="mt-2"
            isPending={verifyMutation.isPending}
            pendingText={t('verifyRecovery.submitting')}
          >
            {t('verifyRecovery.submit')}
          </SubmitButton>
        )}
      </form>

      <div className="mt-4 text-center">
        <button
          className="link link-info font-medium text-xs"
          onClick={() =>
            router.navigate({
              to: '/verify/totp',
              search: extractOAuthParams(search),
            })
          }
          type="button"
        >
          {t('verifyRecovery.backToTotp')}
        </button>
      </div>

      <FooterLink
        as={Link}
        linkText={t('verifyRecovery.backToLogin')}
        search={extractOAuthParams(search)}
        text=""
        to="/login"
      />
    </PageLayout>
  );
}
