import { zodResolver } from '@hookform/resolvers/zod';
import { GlobeIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useLanguage } from '@/hooks/use-language';
import { tick } from '@/libs/promise';
import { loginMutationOptions } from '@/queries/login';
import { getSessionQueryOptions } from '@/queries/session';

export const SearchSchema = z.object({
  query: z.string().optional(),
});

export const Route = createFileRoute('/login/')({
  component: Login,
  validateSearch: SearchSchema,
});

type LoginFormValues = {
  email: string;
  password: string;
};

function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { language, languages, setLanguage } = useLanguage();

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('validation.email.invalid')),
        password: z.string().min(1, t('validation.password.required')),
      }),
    [t],
  );

  const loginMutation = useMutation({
    ...loginMutationOptions,
    onSuccess: async (data) => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: data.user,
      });
      await tick();
      router.navigate({
        to: '/profile',
      });
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
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: 'test-config-user@example.com',
      password: 'changemelater',
    },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      console.log('Login attempt:', values);
      await loginMutation.mutateAsync(values);
    } catch (error) {
      console.error('Login failed:', error);
      setError('email', {
        type: 'manual',
        message: t('login.error.failed'),
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-base-200 to-base-300 p-4">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="card bg-base-100 shadow-2xl">
          <div className="card-body gap-6 p-8">
            {/* Header */}
            <div className="text-center">
              <h1 className="mb-2 font-bold text-4xl tracking-tight">
                {t('login.title')}
              </h1>
              <p className="text-base-content/70 text-sm">
                {t('login.subtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email Input */}
              <div className="form-control">
                <label htmlFor="email" className="label">
                  <span className="label-text font-semibold">
                    {t('login.email.label')}
                  </span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder={t('login.email.placeholder')}
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

              {/* Password Input */}
              <div className="form-control">
                <label htmlFor="password" className="label">
                  <span className="label-text font-semibold">
                    {t('login.password.label')}
                  </span>
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder={t('login.password.placeholder')}
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

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary w-full text-base shadow-lg"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    {t('login.submitting')}
                  </>
                ) : (
                  t('login.submit')
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="divider my-2" />

            <div className="text-center">
              <Link
                to="/register"
                className="link link-hover link-primary font-medium text-sm"
              >
                {t('login.link.register')}
              </Link>
            </div>

            {/* Language Selector */}
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
