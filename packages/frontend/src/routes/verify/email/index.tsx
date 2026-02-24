import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  KeyIcon,
} from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { IconInput } from '#frontend/components/auth/icon-input.js';
import { PageHeader } from '#frontend/components/auth/page-header.js';
import { SubmitButton } from '#frontend/components/auth/submit-button.js';
import { Alert } from '#frontend/components/ui/alert.js';
import { Divider } from '#frontend/components/ui/divider.js';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.js';
import { PageLayout } from '#frontend/features/layout/page-layout.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
  type SecondFactorMethod,
} from '#frontend/libs/oauth-search.js';
import { tick } from '#frontend/libs/promise.js';
import { appConfigQueryOptions } from '#frontend/queries/config.js';
import { getSessionQueryOptions } from '#frontend/queries/session.js';
import {
  resendVerificationMutationOptions,
  verifyEmailMutationOptions,
} from '#frontend/queries/verify-email.js';

const SearchSchema = z.object({
  ...OAuthSearchSchema.shape,
  token: z.string().default(''),
  email: z.string().default(''),
});

export const Route = createFileRoute('/verify/email/')({
  component: VerifyEmail,
  errorComponent: RouteErrorFallback,
  validateSearch: SearchSchema,
  beforeLoad: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(
      appConfigQueryOptions,
    );
    const isPasswordAuthEnabled = config.auth.password.enabled;
    if (!isPasswordAuthEnabled) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(appConfigQueryOptions);
  },
});

type VerifyEmailFormValues = {
  token: string;
};

function VerifyEmail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const { token: queryToken, email } = search;
  const [verified, setVerified] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { data: appConfig } = useSuspenseQuery(appConfigQueryOptions);

  const verifyEmailSchema = useMemo(
    () =>
      z.object({
        token: z.string().min(1, t('validation.token.required')),
      }),
    [t],
  );

  const verifyEmailMutation = useMutation({
    ...verifyEmailMutationOptions,
    onSuccess: async (data) => {
      const user = data.user;

      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: user,
      });
      await tick();

      if (user.second_factor_required) {
        const available_2fa_methods: SecondFactorMethod[] = [];
        if (appConfig.auth.password.totp.enabled) {
          available_2fa_methods.push('totp');
        }
        if (appConfig.auth.passkey.enabled) {
          available_2fa_methods.push('passkey');
        }

        if (available_2fa_methods.length === 1) {
          const method = available_2fa_methods[0];
          if (method === 'totp') {
            return navigate({
              to: '/setup/totp',
              search: extractOAuthParams(search),
            });
          } else {
            return navigate({
              to: '/setup/passkey',
              search: extractOAuthParams(search),
            });
          }
        } else {
          return navigate({
            to: '/setup/2fa',
            search: extractOAuthParams(search),
          });
        }
      }

      if (isOAuthFlow(search)) {
        window.location.href = buildAuthorizeUrl(search);
      } else {
        setVerified(true);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const resendVerificationMutation = useMutation({
    ...resendVerificationMutationOptions,
    onSuccess: () => {
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    },
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyEmailFormValues>({
    defaultValues: {
      token: queryToken || '',
    },
    resolver: standardSchemaResolver(verifyEmailSchema),
  });

  const onSubmit = async (values: VerifyEmailFormValues) => {
    try {
      await verifyEmailMutation.mutateAsync(values);
    } catch (_error) {
      setError('token', {
        type: 'manual',
        message: t('verifyEmail.error.invalidToken'),
      });
    }
  };

  const handleResend = async () => {
    if (!email) {
      return;
    }
    try {
      await resendVerificationMutation.mutateAsync({ email });
    } catch (_error) {}
  };

  if (verified) {
    return (
      <PageLayout cardPadding maxWidth="100">
        <Alert className="mb-4" icon={CheckCircleIcon} type="success">
          {t('verifyEmail.success.title')}
        </Alert>

        <PageHeader
          subtitle={t('verifyEmail.success.description')}
          title={t('verifyEmail.success.subtitle')}
        />

        <button
          className="btn btn-block h-10 font-semibold text-[14px]"
          data-testid="email-verify-go-profile"
          onClick={() => navigate({ to: '/profile' })}
          type="button"
        >
          {t('verifyEmail.success.goToProfile')}
        </button>
      </PageLayout>
    );
  }

  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('verifyEmail.subtitle')}
        title={t('verifyEmail.title')}
      />

      {email && (
        <Alert className="mb-4" icon={EnvelopeSimpleIcon} type="info">
          <div className="text-left">
            <p className="font-semibold">{t('register.success.subtitle')}</p>
            <p className="text-xs">
              {t('register.success.description', { email })}
            </p>
          </div>
        </Alert>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <IconInput
          error={errors.token}
          icon={KeyIcon}
          placeholder={t('verifyEmail.token.placeholder')}
          {...register('token')}
          type="text"
        />

        <SubmitButton
          className="mt-2"
          isPending={verifyEmailMutation.isPending}
          pendingText={t('verifyEmail.submitting')}
        >
          {t('verifyEmail.submit')}
        </SubmitButton>
      </form>

      {email && (
        <>
          <Divider />

          {resendSuccess && (
            <Alert className="mb-2" icon={CheckCircleIcon} type="success">
              {t('verifyEmail.resendSuccess')}
            </Alert>
          )}

          <button
            className="btn btn-ghost btn-sm w-full"
            data-testid="email-verify-resend"
            disabled={resendVerificationMutation.isPending || resendSuccess}
            onClick={handleResend}
            type="button"
          >
            {resendVerificationMutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                {t('verifyEmail.resending')}
              </>
            ) : (
              t('verifyEmail.resend')
            )}
          </button>
        </>
      )}
    </PageLayout>
  );
}
