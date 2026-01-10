import { zodResolver } from '@hookform/resolvers/zod';
import { GlobeIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useLanguage } from '@/hooks/use-language';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise';
import { registerMutationOptions } from '@/queries/register';
import { getSessionQueryOptions } from '@/queries/session';

export const Route = createFileRoute('/register/')({
  component: Register,
  validateSearch: OAuthSearchSchema,
});

type RegisterFormValues = {
  email: string;
  password: string;
};

function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language, languages, setLanguage } = useLanguage();
  const search = Route.useSearch();

  const registerSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('validation.email.invalid')),
        password: z
          .string()
          .min(6, t('validation.password.min'))
          .max(100, t('validation.password.max')),
      }),
    [t],
  );

  const registerMutation = useMutation({
    ...registerMutationOptions,
    onSuccess: async (data) => {
      // Check if email verification is required
      if (data.user.email_verified) {
        // Email already verified (SMTP not configured)
        // Set session data
        queryClient.setQueryData(getSessionQueryOptions.queryKey, {
          user: data.user,
        });
        await tick();

        // Check if this is an OAuth flow
        if (isOAuthFlow(search)) {
          // Redirect to authorization endpoint with OAuth parameters
          window.location.href = buildAuthorizeUrl(search);
        } else {
          // Regular registration - navigate to profile
          navigate({ to: '/profile' });
        }
      } else {
        // Email verification required (SMTP configured)
        // Navigate to verify email page with OAuth parameters preserved
        await tick();
        navigate({
          to: '/verify-email',
          search: {
            email: data.user.email,
            token: '',
            ...extractOAuthParams(search),
          },
        });
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
    formState: { errors },
  } = useForm<RegisterFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      console.log('Register attempt:', values);
      await registerMutation.mutateAsync(values);
    } catch (error) {
      console.error('Register failed:', error);
      setError('email', {
        type: 'manual',
        message: t('register.error.emailExists'),
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-base-200 to-base-300 p-4">
      <div className="w-full max-w-md">
        <div className="card bg-base-100 shadow-2xl">
          <div className="card-body gap-6 p-8">
            <div className="text-center">
              <h1 className="mb-2 font-bold text-4xl tracking-tight">
                {t('register.title')}
              </h1>
              <p className="text-base-content/70 text-sm">
                {t('register.subtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="form-control">
                <label htmlFor="email" className="label">
                  <span className="label-text font-semibold">
                    {t('register.email.label')}
                  </span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder={t('register.email.placeholder')}
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

              <div className="form-control">
                <label htmlFor="password" className="label">
                  <span className="label-text font-semibold">
                    {t('register.password.label')}
                  </span>
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder={t('register.password.placeholder')}
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

              <button
                type="submit"
                className="btn btn-primary w-full text-base shadow-lg"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    {t('register.submitting')}
                  </>
                ) : (
                  t('register.submit')
                )}
              </button>
            </form>

            <div className="divider my-2" />

            <div className="text-center">
              <Link
                to="/login"
                search={extractOAuthParams(search)}
                className="link link-hover link-primary font-medium text-sm"
              >
                {t('register.link.login')}
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
