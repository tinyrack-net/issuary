import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  CheckCircle,
  Key,
  Lock,
  LockKey,
  Moon,
  Sun,
} from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { useTheme } from '@/hooks/use-theme';
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
  const { theme, toggleDarkMode } = useTheme();
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
    resolver: standardSchemaResolver(resetPasswordSchema),
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
            <span>{t('resetPassword.success.title')}</span>
          </div>

          {/* Header */}
          <h1 className="mb-2 text-center font-bold text-3xl">
            {t('resetPassword.success.subtitle')}
          </h1>
          <p className="mb-6 text-center text-base-content/60 text-xs">
            {t('resetPassword.success.description')}
          </p>

          <button
            type="button"
            onClick={() => navigate({ to: '/login' })}
            className="btn btn-block h-10 font-semibold text-[14px]"
          >
            {t('resetPassword.success.goToLogin')}
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
          {t('resetPassword.title')}
        </h1>
        <p className="mb-6 text-center text-base-content/60 text-xs">
          {t('resetPassword.subtitle')}
        </p>

        {/* Reset Password Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Token field - hidden if provided via URL */}
          {!queryToken && (
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
                  placeholder={t('resetPassword.token.placeholder')}
                  {...register('token')}
                />
              </label>
              {errors.token && (
                <p className="mt-1 text-error text-sm">
                  {errors.token.message}
                </p>
              )}
            </div>
          )}

          {/* Show error for token even when hidden */}
          {queryToken && errors.token && (
            <div className="alert alert-error">
              <span className="text-sm">{errors.token.message}</span>
            </div>
          )}

          <div>
            <label
              className={`input input-bordered flex items-center gap-2 ${
                errors.password ? 'input-error' : ''
              }`}
            >
              <Lock className="size-5 opacity-70" />
              <input
                type="password"
                className="grow"
                placeholder={t('resetPassword.password.placeholder')}
                autoComplete="new-password"
                {...register('password')}
              />
            </label>
            {errors.password && (
              <p className="mt-1 text-error text-sm">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label
              className={`input input-bordered flex items-center gap-2 ${
                errors.confirmPassword ? 'input-error' : ''
              }`}
            >
              <LockKey className="size-5 opacity-70" />
              <input
                type="password"
                className="grow"
                placeholder={t('resetPassword.confirmPassword.placeholder')}
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
            </label>
            {errors.confirmPassword && (
              <p className="mt-1 text-error text-sm">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-block mt-2 h-10 font-semibold text-[14px]"
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

        {/* Footer */}
        <div className="mt-6 text-center text-base-content/70 text-xs">
          <Link to="/login" className="link link-info font-medium">
            {t('resetPassword.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
