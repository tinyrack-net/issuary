import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { CheckCircleIcon, EnvelopeSimpleIcon, KeyIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import {
  AuthPageLayout,
  IconInput,
  PageHeader,
  SubmitButton,
} from '@/components/auth/index.js';
import { Alert, Divider } from '@/components/ui/index.js';
import {
  buildAuthorizeUrl,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
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

export const Route = createFileRoute('/verify-email/')({
  component: VerifyEmail,
  validateSearch: SearchSchema,
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
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: data.user,
      });
      await tick();

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
