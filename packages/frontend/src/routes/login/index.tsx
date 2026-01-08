import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckIcon,
  GlobeIcon,
  MoonIcon,
  PaintBrushIcon,
  SunIcon,
} from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useLanguage } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
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
  const { theme, themes, setTheme, toggleDarkMode } = useTheme();
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
      email: 'admin@example.com',
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
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-4">
      <div className="w-full max-w-md">
        {/* Theme Controls */}
        <div className="mb-6 flex justify-end gap-2">
          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="btn btn-circle btn-ghost"
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? (
              <SunIcon size={24} weight="regular" />
            ) : (
              <MoonIcon size={24} weight="regular" />
            )}
          </button>

          {/* Language Selector */}
          <div className="dropdown dropdown-end">
            <button
              type="button"
              tabIndex={0}
              className="btn btn-circle btn-ghost"
              aria-label={t('common.language.select')}
            >
              <GlobeIcon size={24} weight="regular" />
            </button>
            <ul className="menu dropdown-content z-[1] w-52 rounded-box bg-base-100 p-2 shadow-lg">
              {languages.map((lang) => (
                <li key={lang}>
                  <button
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={language === lang ? 'active' : ''}
                  >
                    <span>
                      {t(
                        `common.language.${
                          lang === 'ko'
                            ? 'korean'
                            : lang === 'en'
                              ? 'english'
                              : 'japanese'
                        }`,
                      )}
                    </span>
                    {language === lang && <CheckIcon size={20} weight="bold" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Theme Selector Dropdown */}
          <div className="dropdown dropdown-end">
            <button
              type="button"
              tabIndex={0}
              className="btn btn-circle btn-ghost"
              aria-label="Select theme"
            >
              <PaintBrushIcon size={24} weight="regular" />
            </button>
            <ul className="menu dropdown-content z-[1] max-h-96 w-52 overflow-y-auto rounded-box bg-base-100 p-2 shadow-lg">
              {themes.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => setTheme(t)}
                    className={theme === t ? 'active' : ''}
                  >
                    <span className="capitalize">{t}</span>
                    {theme === t && <CheckIcon size={20} weight="bold" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Login Card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-2 justify-center font-bold text-3xl">
              {t('login.title')}
            </h2>
            <p className="mb-6 text-center text-base-content/60">
              {t('login.subtitle')}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email Input */}
              <div className="form-control">
                <label htmlFor="email" className="label">
                  <span className="label-text font-medium">
                    {t('login.email.label')}
                  </span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder={t('login.email.placeholder')}
                  className={`input input-bordered w-full ${
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
                  <span className="label-text font-medium">
                    {t('login.password.label')}
                  </span>
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder={t('login.password.placeholder')}
                  className={`input input-bordered w-full ${
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
              <div className="form-control mt-6">
                <button
                  type="submit"
                  className={`btn btn-primary w-full ${
                    loginMutation.isPending ? 'btn-disabled' : ''
                  }`}
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
              </div>
            </form>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-4 text-center text-base-content/60 text-sm">
          <p>{t('common.theme.current', { theme })}</p>
        </div>
      </div>
    </div>
  );
}
