import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { EnvelopeSimple, Lock, Moon, Sun } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { useTheme } from '@/hooks/use-theme';
import { extractOAuthParams, OAuthSearchSchema } from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise';
import { loginMutationOptions } from '@/queries/login';
import { oauthProvidersQueryOptions } from '@/queries/oauth';
import { getSessionQueryOptions } from '@/queries/session';

export const SearchSchema = OAuthSearchSchema;

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
  const { theme, toggleDarkMode } = useTheme();
  const search = Route.useSearch();

  // Fetch available OAuth providers
  const { data: oauthProvidersData } = useQuery(oauthProvidersQueryOptions);
  const oauthProviders = oauthProvidersData?.providers || [];

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.email(t('validation.email.invalid')),
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

      // Check if this is an OAuth login flow
      if (search.client_id && search.redirect_uri) {
        // Build authorization endpoint URL with OAuth parameters
        const authUrl = new URL(
          '/application/oauth/authorize',
          window.location.origin,
        );
        authUrl.searchParams.set('client_id', search.client_id);
        authUrl.searchParams.set('redirect_uri', search.redirect_uri);
        authUrl.searchParams.set(
          'response_type',
          search.response_type || 'code',
        );

        if (search.scope) authUrl.searchParams.set('scope', search.scope);
        if (search.state) authUrl.searchParams.set('state', search.state);
        if (search.nonce) authUrl.searchParams.set('nonce', search.nonce);
        if (search.code_challenge)
          authUrl.searchParams.set('code_challenge', search.code_challenge);
        if (search.code_challenge_method)
          authUrl.searchParams.set(
            'code_challenge_method',
            search.code_challenge_method,
          );
        if (search.prompt) authUrl.searchParams.set('prompt', search.prompt);
        if (search.max_age) authUrl.searchParams.set('max_age', search.max_age);
        if (search.display) authUrl.searchParams.set('display', search.display);

        // Redirect to authorization endpoint (full page redirect)
        window.location.href = authUrl.toString();
      } else {
        // Regular login (not OAuth) - navigate to profile
        router.navigate({
          to: '/profile',
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
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: 'test-config-user@example.com',
      password: 'changemelater',
    },
    resolver: standardSchemaResolver(loginSchema),
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

  // Build OAuth URL helper
  const buildOAuthUrl = (providerName: string) => {
    let oauthUrl = `/api/v1/oauth/${providerName}/connect?mode=login`;

    if (search.client_id && search.redirect_uri) {
      const authUrl = new URL(
        '/application/oauth/authorize',
        window.location.origin,
      );
      authUrl.searchParams.set('client_id', search.client_id);
      authUrl.searchParams.set('redirect_uri', search.redirect_uri);
      authUrl.searchParams.set('response_type', search.response_type || 'code');

      if (search.scope) authUrl.searchParams.set('scope', search.scope);
      if (search.state) authUrl.searchParams.set('state', search.state);
      if (search.nonce) authUrl.searchParams.set('nonce', search.nonce);
      if (search.code_challenge)
        authUrl.searchParams.set('code_challenge', search.code_challenge);
      if (search.code_challenge_method)
        authUrl.searchParams.set(
          'code_challenge_method',
          search.code_challenge_method,
        );
      if (search.prompt) authUrl.searchParams.set('prompt', search.prompt);
      if (search.max_age) authUrl.searchParams.set('max_age', search.max_age);
      if (search.display) authUrl.searchParams.set('display', search.display);

      oauthUrl += `&return_url=${encodeURIComponent(authUrl.toString())}`;
    }

    return oauthUrl;
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
          {t('login.title')}
        </h1>
        <p className="mb-6 text-center text-base-content/70">
          {t('login.subtitle')}
        </p>

        {/* Social Login Buttons */}
        {oauthProviders.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {oauthProviders.map((provider) => (
                <a
                  key={provider.name}
                  href={buildOAuthUrl(provider.name)}
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
                {t('login.divider.orContinueWithEmail')}
              </span>
              <div className="h-px flex-1 bg-base-200" />
            </div>
          </>
        )}

        {/* Email and Password Form */}
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
                placeholder={t('login.email.placeholder')}
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
                placeholder={t('login.password.placeholder')}
                autoComplete="current-password"
                {...register('password')}
              />
            </label>
            {errors.password && (
              <p className="mt-1 text-error text-sm">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="checkbox checkbox-sm" />
              <span className="text-sm">{t('login.rememberMe')}</span>
            </label>
            <Link to="/forgot-password" className="link text-sm">
              {t('login.link.forgotPassword')}
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-block mt-2 h-10 font-semibold text-[14px]"
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

        {/* Footer */}
        <div className="mt-6 text-center text-base-content/70 text-xs">
          {t('login.footer.noAccount')}{' '}
          <Link
            to="/register"
            search={extractOAuthParams(search)}
            className="link link-info font-medium"
          >
            {t('login.link.register')}
          </Link>
        </div>
      </div>
    </div>
  );
}
