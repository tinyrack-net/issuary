import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircleIcon,
  EnvelopeIcon,
  GlobeIcon,
} from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useLanguage } from '@/hooks/use-language';
import { forgotPasswordMutationOptions } from '@/queries/password-reset';

export const Route = createFileRoute('/forgot-password/')({
  component: ForgotPassword,
});

type ForgotPasswordFormValues = {
  email: string;
};

function ForgotPassword() {
  const { t } = useTranslation();
  const { language, languages, setLanguage } = useLanguage();
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
    resolver: zodResolver(forgotPasswordSchema),
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
                  {t('forgotPassword.success.title')}
                </h1>
                <p className="mb-1 font-semibold text-base-content text-lg">
                  {t('forgotPassword.success.subtitle')}
                </p>
                <p className="text-base-content/70 text-sm">
                  {t('forgotPassword.success.description', {
                    email: submittedEmail,
                  })}
                </p>
              </div>

              <div className="alert alert-info">
                <EnvelopeIcon size={20} weight="fill" />
                <span className="text-left text-sm">
                  {t('forgotPassword.success.checkSpam')}
                </span>
              </div>

              <Link
                to="/login"
                className="btn btn-primary w-full text-base shadow-lg"
              >
                {t('forgotPassword.backToLogin')}
              </Link>

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
                {t('forgotPassword.title')}
              </h1>
              <p className="text-base-content/70 text-sm">
                {t('forgotPassword.subtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="form-control">
                <label htmlFor="email" className="label">
                  <span className="label-text font-semibold">
                    {t('forgotPassword.email.label')}
                  </span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder={t('forgotPassword.email.placeholder')}
                  className={`input input-bordered focus:input-primary w-full transition-all ${
                    errors.email ? 'input-error' : ''
                  }`}
                  {...register('email')}
                />
                {errors.email && (
                  <div className="label">
                    <span className="label-text-alt text-error">
                      {errors.email.message}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full text-base shadow-lg"
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

            <div className="divider my-2" />

            <div className="text-center">
              <Link
                to="/login"
                className="link link-hover link-primary font-medium text-sm"
              >
                {t('forgotPassword.backToLogin')}
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
