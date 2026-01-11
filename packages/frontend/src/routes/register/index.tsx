import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { EnvelopeSimple, Lock, Moon, Sun } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { useTheme } from '@/hooks/use-theme';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise';
import {
  getOAuthConnectUrl,
  oauthProvidersQueryOptions,
} from '@/queries/oauth';
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
  const { theme, toggleDarkMode } = useTheme();
  const search = Route.useSearch();

  // Fetch available OAuth providers
  const { data: oauthProvidersData } = useQuery(oauthProvidersQueryOptions);
  const oauthProviders = oauthProvidersData?.providers || [];

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
    resolver: standardSchemaResolver(registerSchema),
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
          {t('register.title')}
        </h1>
        <p className="mb-6 text-center text-base-content/60 text-xs">
          {t('register.subtitle')}
        </p>

        {/* Social Signup Buttons */}
        {oauthProviders.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {oauthProviders.map((provider) => (
                <a
                  key={provider.name}
                  href={getOAuthConnectUrl(provider.name, 'register')}
                  className="btn border-base-300"
                >
                  {provider.icon_url && (
                    <img
                      src={provider.icon_url}
                      alt={provider.display_name}
                      className="h-4 w-4"
                    />
                  )}
                  {provider.display_name}
                </a>
              ))}
            </div>

            {/* Divider */}
            <div className="my-4 flex items-center">
              <div className="h-px flex-1 bg-base-200" />
              <span className="px-3 text-base-content/60 text-sm">
                {t('register.divider.orSignUpWithEmail')}
              </span>
              <div className="h-px flex-1 bg-base-200" />
            </div>
          </>
        )}

        {/* Signup Form */}
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
                placeholder={t('register.email.placeholder')}
                autoComplete="email"
                {...register('email')}
              />
            </label>
            {errors.email && (
              <p className="mt-1 text-error text-sm">{errors.email.message}</p>
            )}
          </div>

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
                placeholder={t('register.password.placeholder')}
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

          <button
            type="submit"
            className="btn btn-block mt-2 h-10 font-semibold text-[14px]"
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

        {/* Footer */}
        <div className="mt-6 text-center text-base-content/70 text-xs">
          {t('register.footer.haveAccount')}{' '}
          <Link
            to="/login"
            search={extractOAuthParams(search)}
            className="link link-info font-medium"
          >
            {t('register.link.login')}
          </Link>
        </div>
      </div>
    </div>
  );
}
