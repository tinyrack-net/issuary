import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  CheckCircle,
  EnvelopeSimple,
  Key,
  Moon,
  Sun,
} from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { useTheme } from '@/hooks/use-theme';
import {
  buildAuthorizeUrl,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise';
import { getSessionQueryOptions } from '@/queries/session';
import {
  resendVerificationMutationOptions,
  verifyEmailMutationOptions,
} from '@/queries/verify-email';

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
  const { theme, toggleDarkMode } = useTheme();
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

      // Check if this is an OAuth flow
      if (isOAuthFlow(search)) {
        // Redirect to authorization endpoint with OAuth parameters
        window.location.href = buildAuthorizeUrl(search);
      } else {
        // Regular verification - show success state
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
      <div
        className="flex min-h-screen items-center justify-center bg-cover p-4"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2071)',
        }}
      >
        {/* Theme Toggle */}
        <label className="swap swap-rotate btn btn-sm btn-circle absolute start-4 top-4">
          <input
            type="checkbox"
            checked={theme === 'dark'}
            onChange={toggleDarkMode}
          />
          <Sun className="swap-off size-4" weight="fill" />
          <Moon className="swap-on size-4" weight="fill" />
        </label>

        <div className="card w-full max-w-100 border border-base-200 bg-base-100 p-12 shadow-lg">
          {/* Success Alert */}
          <div className="alert alert-success mb-4">
            <CheckCircle className="size-5" weight="fill" />
            <span>{t('verifyEmail.success.title')}</span>
          </div>

          {/* Header */}
          <h1 className="mb-2 text-center font-bold text-3xl">
            {t('verifyEmail.success.subtitle')}
          </h1>
          <p className="mb-6 text-center text-base-content/60 text-xs">
            {t('verifyEmail.success.description')}
          </p>

          <button
            type="button"
            onClick={() => navigate({ to: '/profile' })}
            className="btn btn-block h-10 font-semibold text-[14px]"
          >
            {t('verifyEmail.success.goToProfile')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover p-4"
      style={{
        backgroundImage:
          'url(https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2071)',
      }}
    >
      {/* Theme Toggle */}
      <label className="swap swap-rotate btn btn-sm btn-circle absolute start-4 top-4">
        <input
          type="checkbox"
          checked={theme === 'dark'}
          onChange={toggleDarkMode}
        />
        <Sun className="swap-off size-4" weight="fill" />
        <Moon className="swap-on size-4" weight="fill" />
      </label>

      <div className="card w-full max-w-100 border border-base-200 bg-base-100 p-12 shadow-lg">
        {/* Header */}
        <h1 className="mb-2 text-center font-bold text-3xl">
          {t('verifyEmail.title')}
        </h1>
        <p className="mb-6 text-center text-base-content/60 text-xs">
          {t('verifyEmail.subtitle')}
        </p>

        {/* Email sent info */}
        {email && (
          <div className="alert alert-info mb-4">
            <EnvelopeSimple className="size-5" weight="fill" />
            <div className="text-left text-sm">
              <p className="font-semibold">{t('register.success.subtitle')}</p>
              <p className="text-xs">
                {t('register.success.description', { email })}
              </p>
            </div>
          </div>
        )}

        {/* Verify Email Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label
              className={`input input-bordered flex items-center gap-2 ${
                errors.token ? 'input-error' : ''
              }`}
            >
              <Key className="size-5 opacity-70" />
              <input
                type="text"
                className="grow font-mono"
                placeholder={t('verifyEmail.token.placeholder')}
                {...register('token')}
              />
            </label>
            {errors.token && (
              <p className="mt-1 text-error text-sm">{errors.token.message}</p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-block mt-2 h-10 font-semibold text-[14px]"
            disabled={verifyEmailMutation.isPending}
          >
            {verifyEmailMutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                {t('verifyEmail.submitting')}
              </>
            ) : (
              t('verifyEmail.submit')
            )}
          </button>
        </form>

        {/* Resend section */}
        {email && (
          <>
            <div className="my-4 flex items-center">
              <div className="h-px flex-1 bg-base-200" />
            </div>

            {resendSuccess && (
              <div className="alert alert-success mb-2">
                <CheckCircle className="size-5" weight="fill" />
                <span className="text-sm">
                  {t('verifyEmail.resendSuccess')}
                </span>
              </div>
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
      </div>
    </div>
  );
}
