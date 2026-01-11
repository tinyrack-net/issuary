import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircleIcon, GlobeIcon, LockIcon } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { useLanguage } from '@/hooks/use-language';
import { resetPasswordMutationOptions } from '@/queries/password-reset';

const SearchSchema = z.object({
  token: z.string().default(''),
});

export const Route = createFileRoute('/reset-password/')({
  component: ResetPassword,
  validateSearch: SearchSchema,
});

type ResetPasswordFormValues = {
  token: string;
  password: string;
  confirmPassword: string;
};

function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, languages, setLanguage } = useLanguage();
  const search = Route.useSearch();
  const { token: queryToken } = search;
  const [resetSuccess, setResetSuccess] = useState(false);

  const resetPasswordSchema = useMemo(
    () =>
      z
        .object({
          token: z.string().min(1, t('validation.token.required')),
          password: z
            .string()
            .min(6, t('validation.password.min'))
            .max(100, t('validation.password.max')),
          confirmPassword: z
            .string()
            .min(1, t('validation.confirmPassword.required')),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('validation.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  );

  const resetPasswordMutation = useMutation({
    ...resetPasswordMutationOptions,
    onSuccess: () => {
      setResetSuccess(true);
    },
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    defaultValues: {
      token: queryToken || '',
      password: '',
      confirmPassword: '',
    },
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    try {
      await resetPasswordMutation.mutateAsync({
        token: values.token,
        password: values.password,
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'INVALID_PASSWORD_RESET_TOKEN') {
          setError('token', {
            type: 'manual',
            message: t('resetPassword.error.invalidToken'),
          });
        } else if (error.code === 'USER_NOT_EDITABLE') {
          setError('token', {
            type: 'manual',
            message: t('resetPassword.error.notEditable'),
          });
        }
      } else {
        setError('token', {
          type: 'manual',
          message: t('resetPassword.error.invalidToken'),
        });
      }
    }
  };

  if (resetSuccess) {
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
                  {t('resetPassword.success.title')}
                </h1>
                <p className="mb-1 font-semibold text-base-content text-lg">
                  {t('resetPassword.success.subtitle')}
                </p>
                <p className="text-base-content/70 text-sm">
                  {t('resetPassword.success.description')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate({ to: '/login' })}
                className="btn btn-primary w-full text-base shadow-lg"
              >
                {t('resetPassword.success.goToLogin')}
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
                <LockIcon size={64} weight="duotone" className="text-primary" />
              </div>
              <h1 className="mb-2 font-bold text-4xl tracking-tight">
                {t('resetPassword.title')}
              </h1>
              <p className="text-base-content/70 text-sm">
                {t('resetPassword.subtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Token field - hidden if provided via URL */}
              {!queryToken && (
                <div className="form-control">
                  <label htmlFor="token" className="label">
                    <span className="label-text font-semibold">
                      {t('resetPassword.token.label')}
                    </span>
                  </label>
                  <input
                    id="token"
                    type="text"
                    placeholder={t('resetPassword.token.placeholder')}
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
              )}

              {/* Show error for token even when hidden */}
              {queryToken && errors.token && (
                <div className="alert alert-error">
                  <span className="text-sm">{errors.token.message}</span>
                </div>
              )}

              <div className="form-control">
                <label htmlFor="password" className="label">
                  <span className="label-text font-semibold">
                    {t('resetPassword.password.label')}
                  </span>
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder={t('resetPassword.password.placeholder')}
                  className={`input input-bordered focus:input-primary w-full transition-all ${
                    errors.password ? 'input-error' : ''
                  }`}
                  {...register('password')}
                />
                {errors.password && (
                  <div className="label">
                    <span className="label-text-alt text-error">
                      {errors.password.message}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-control">
                <label htmlFor="confirmPassword" className="label">
                  <span className="label-text font-semibold">
                    {t('resetPassword.confirmPassword.label')}
                  </span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder={t('resetPassword.confirmPassword.placeholder')}
                  className={`input input-bordered focus:input-primary w-full transition-all ${
                    errors.confirmPassword ? 'input-error' : ''
                  }`}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <div className="label">
                    <span className="label-text-alt text-error">
                      {errors.confirmPassword.message}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full text-base shadow-lg"
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    {t('resetPassword.submitting')}
                  </>
                ) : (
                  t('resetPassword.submit')
                )}
              </button>
            </form>

            <div className="divider my-2" />

            <div className="text-center">
              <Link
                to="/login"
                className="link link-hover link-primary font-medium text-sm"
              >
                {t('resetPassword.backToLogin')}
              </Link>
            </div>

            <div className="flex items-center justify-center gap-3">
              <GlobeIcon
                size={18}
                weight="regular"
                className="text-base-content/50"
              />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
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
