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
import { z } from 'zod/v4';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { IconInput } from '@/components/auth/icon-input.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { Alert } from '@/components/ui/alert.js';
import { Divider } from '@/components/ui/divider.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
  type SecondFactorMethod,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { appConfigQueryOptions } from '@/queries/config.js';
import { getSessionQueryOptions } from '@/queries/session.js';
import {
  resendVerificationMutationOptions,
  verifyEmailMutationOptions,
} from '@/queries/verify-email.js';

const SearchSchema = z
  .object({
    token: z.string().default(''),
    email: z.string().default(''),
  })
  .merge(OAuthSearchSchema);

export const Route = createFileRoute('/verify/email/')({
  component: VerifyEmail,
  validateSearch: SearchSchema,
  beforeLoad: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(
      appConfigQueryOptions,
    );
    const isPasswordAuthEnabled =
      config.basic_authentication_methods.password.enabled;
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
        if (appConfig.basic_authentication_methods.password.totp.enabled) {
          available_2fa_methods.push('totp');
        }
        if (appConfig.basic_authentication_methods.passkey.enabled) {
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
    } catch (error) {
      console.error('Verification failed:', error);
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
    } catch (error) {
      console.error('Resend failed:', error);
    }
  };

  if (verified) {
    return (
      <AuthPageLayout>
        <Alert type="success" icon={CheckCircleIcon} className="mb-4">
          {t('verifyEmail.success.title')}
        </Alert>

        <PageHeader
          title={t('verifyEmail.success.subtitle')}
          subtitle={t('verifyEmail.success.description')}
        />

        <button
          type="button"
          onClick={() => navigate({ to: '/profile' })}
          className="btn btn-block h-10 font-semibold text-[14px]"
        >
          {t('verifyEmail.success.goToProfile')}
        </button>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <PageHeader
        title={t('verifyEmail.title')}
        subtitle={t('verifyEmail.subtitle')}
      />

      {email && (
        <Alert type="info" icon={EnvelopeSimpleIcon} className="mb-4">
          <div className="text-left">
            <p className="font-semibold">{t('register.success.subtitle')}</p>
            <p className="text-xs">
              {t('register.success.description', { email })}
            </p>
          </div>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <IconInput
          icon={KeyIcon}
          type="text"
          placeholder={t('verifyEmail.token.placeholder')}
          error={errors.token}
          {...register('token')}
        />

        <SubmitButton
          isPending={verifyEmailMutation.isPending}
          pendingText={t('verifyEmail.submitting')}
          className="mt-2"
        >
          {t('verifyEmail.submit')}
        </SubmitButton>
      </form>

      {email && (
        <>
          <Divider />

          {resendSuccess && (
            <Alert type="success" icon={CheckCircleIcon} className="mb-2">
              {t('verifyEmail.resendSuccess')}
            </Alert>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={resendVerificationMutation.isPending || resendSuccess}
            className="btn btn-ghost btn-sm w-full"
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
    </AuthPageLayout>
  );
}
