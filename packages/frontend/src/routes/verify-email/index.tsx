import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircleIcon,
  EnvelopeIcon,
  GlobeIcon,
} from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { useLanguage } from '@/hooks/use-language';
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
  const { language, languages, setLanguage } = useLanguage();
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
    resolver: zodResolver(verifyEmailSchema),
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
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-base-200 to-base-300 p-4">
        <div className="w-full max-w-md">
          <div className="card bg-base-100 shadow-2xl">
            <div className="card-body gap-6 p-8 text-center">
              <div className="mx-auto">
                <CheckCircleIcon
                  size={80}
                  weight="duotone"
                  className="text-success"
                />
              </div>
              <div>
                <h1 className="mb-2 font-bold text-3xl text-success tracking-tight">
                  {t('verifyEmail.success.title')}
                </h1>
                <p className="mb-1 font-semibold text-base-content text-lg">
                  {t('verifyEmail.success.subtitle')}
                </p>
                <p className="text-base-content/70 text-sm">
                  {t('verifyEmail.success.description')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate({ to: '/profile' })}
                className="btn btn-primary w-full text-base shadow-lg"
              >
                {t('verifyEmail.success.goToProfile')}
              </button>

              <div className="flex items-center justify-center gap-3">
                <GlobeIcon
                  size={18}
                  weight="regular"
                  className="text-base-content/50"
                />
                <select
                  value={language}
                  onChange={(e) =>
                    setLanguage(e.target.value as typeof language)
                  }
                  className="select select-bordered select-sm w-auto min-w-35 font-medium"
                  aria-label={t('common.language.select')}
                >
                  {languages.map((lang) => (
                    <option key={lang} value={lang}>
                      {t(
                        `common.language.${
                          lang === 'ko'
                            ? 'korean'
                            : lang === 'en'
                              ? 'english'
                              : 'japanese'
                        }`,
                      )}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-base-200 to-base-300 p-4">
      <div className="w-full max-w-md">
        <div className="card bg-base-100 shadow-2xl">
          <div className="card-body gap-6 p-8">
            <div className="text-center">
              <div className="mx-auto mb-4">
                <EnvelopeIcon
                  size={64}
                  weight="duotone"
                  className="text-primary"
                />
              </div>
              <h1 className="mb-2 font-bold text-4xl tracking-tight">
                {t('verifyEmail.title')}
              </h1>
              <p className="text-base-content/70 text-sm">
                {t('verifyEmail.subtitle')}
              </p>
              {email && (
                <div className="alert alert-info mt-4">
                  <CheckCircleIcon size={20} weight="fill" />
                  <div className="text-left text-sm">
                    <p className="font-semibold">
                      {t('register.success.subtitle')}
                    </p>
                    <p className="text-xs">
                      {t('register.success.description', { email })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="form-control">
                <label htmlFor="token" className="label">
                  <span className="label-text font-semibold">
                    {t('verifyEmail.token.label')}
                  </span>
                </label>
                <input
                  id="token"
                  type="text"
                  placeholder={t('verifyEmail.token.placeholder')}
                  className={`input input-bordered focus:input-primary w-full font-mono transition-all ${
                    errors.token ? 'input-error' : ''
                  }`}
                  {...register('token')}
                />
                {errors.token && (
                  <div className="label">
                    <span className="label-text-alt text-error">
                      {errors.token.message}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full text-base shadow-lg"
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

            {email && (
              <>
                <div className="divider my-2" />

                {resendSuccess && (
                  <div className="alert alert-success mb-2">
                    <CheckCircleIcon size={20} weight="fill" />
                    <span className="text-sm">
                      {t('verifyEmail.resendSuccess')}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={
                    resendVerificationMutation.isPending || resendSuccess
                  }
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

            <div className="flex items-center justify-center gap-3">
              <GlobeIcon
                size={18}
                weight="regular"
                className="text-base-content/50"
              />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
                className="select select-sm select-bordered w-auto min-w-35 font-medium"
                aria-label={t('common.language.select')}
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {t(
                      `common.language.${
                        lang === 'ko'
                          ? 'korean'
                          : lang === 'en'
                            ? 'english'
                            : 'japanese'
                      }`,
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
