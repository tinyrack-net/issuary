import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { CheckCircle, EnvelopeSimple, Moon, Sun } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { useTheme } from '@/hooks/use-theme';
import { forgotPasswordMutationOptions } from '@/queries/password-reset';

export const Route = createFileRoute('/forgot-password/')({
  component: ForgotPassword,
});

type ForgotPasswordFormValues = {
  email: string;
};

function ForgotPassword() {
  const { t } = useTranslation();
  const { theme, toggleDarkMode } = useTheme();
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const forgotPasswordSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('validation.email.invalid')),
      }),
    [t],
  );

  const forgotPasswordMutation = useMutation({
    ...forgotPasswordMutationOptions,
    onSuccess: () => {
      setEmailSent(true);
    },
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    defaultValues: {
      email: '',
    },
    resolver: standardSchemaResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      setSubmittedEmail(values.email);
      await forgotPasswordMutation.mutateAsync(values);
    } catch (error) {
      // Check if this is a "user not editable" error
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'USER_NOT_EDITABLE'
      ) {
        setError('email', {
          type: 'manual',
          message: t('forgotPassword.error.notEditable'),
        });
      } else {
        // For other errors, still show success to prevent enumeration
        setEmailSent(true);
      }
    }
  };

  if (emailSent) {
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
            <span>{t('forgotPassword.success.title')}</span>
          </div>

          {/* Header */}
          <h1 className="mb-2 text-center font-bold text-3xl">
            {t('forgotPassword.success.subtitle')}
          </h1>
          <p className="mb-6 text-center text-base-content/60 text-xs">
            {t('forgotPassword.success.description', {
              email: submittedEmail,
            })}
          </p>

          <div className="alert alert-info mb-4">
            <EnvelopeSimple className="size-5" weight="fill" />
            <span className="text-left text-sm">
              {t('forgotPassword.success.checkSpam')}
            </span>
          </div>

          <Link
            to="/login"
            className="btn btn-block h-10 font-semibold text-[14px]"
          >
            {t('forgotPassword.backToLogin')}
          </Link>
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
          {t('forgotPassword.title')}
        </h1>
        <p className="mb-6 text-center text-base-content/60 text-xs">
          {t('forgotPassword.subtitle')}
        </p>

        {/* Recovery Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label
              className={`input input-bordered flex items-center gap-2 ${
                errors.email ? 'input-error' : ''
              }`}
            >
              <EnvelopeSimple className="size-5 opacity-70" />
              <input
                type="email"
                className="grow"
                placeholder={t('forgotPassword.email.placeholder')}
                autoComplete="email"
                {...register('email')}
              />
            </label>
            {errors.email && (
              <p className="mt-1 text-error text-sm">{errors.email.message}</p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-block mt-2 h-10 font-semibold text-[14px]"
            disabled={forgotPasswordMutation.isPending}
          >
            {forgotPasswordMutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                {t('forgotPassword.submitting')}
              </>
            ) : (
              t('forgotPassword.submit')
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-base-content/70 text-xs">
          {t('forgotPassword.footer.rememberedPassword')}{' '}
          <Link to="/login" className="link link-info font-medium">
            {t('register.link.login')}
          </Link>
        </div>
      </div>
    </div>
  );
}
