import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { GlobeIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useLanguage } from '@/hooks/use-language';
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
  const { language, languages, setLanguage } = useLanguage();
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

            {/* OAuth Providers */}
            {oauthProviders.length > 0 && (
              <>
                <div className="divider my-2">{t('oauth.divider')}</div>
                <div className="flex flex-col gap-2">
                  {oauthProviders.map((provider) => {
                    // Build return URL if this is an OIDC flow
                    let oauthUrl = `/api/v1/oauth/${provider.name}/connect?mode=login`;

                    if (search.client_id && search.redirect_uri) {
                      // Build authorization endpoint URL
                      const authUrl = new URL(
                        '/application/oauth/authorize',
                        window.location.origin,
                      );
                      authUrl.searchParams.set('client_id', search.client_id);
                      authUrl.searchParams.set(
                        'redirect_uri',
                        search.redirect_uri,
                      );
                      authUrl.searchParams.set(
                        'response_type',
                        search.response_type || 'code',
                      );

                      if (search.scope)
                        authUrl.searchParams.set('scope', search.scope);
                      if (search.state)
                        authUrl.searchParams.set('state', search.state);
                      if (search.nonce)
                        authUrl.searchParams.set('nonce', search.nonce);
                      if (search.code_challenge)
                        authUrl.searchParams.set(
                          'code_challenge',
                          search.code_challenge,
                        );
                      if (search.code_challenge_method)
                        authUrl.searchParams.set(
                          'code_challenge_method',
                          search.code_challenge_method,
                        );
                      if (search.prompt)
                        authUrl.searchParams.set('prompt', search.prompt);
                      if (search.max_age)
                        authUrl.searchParams.set('max_age', search.max_age);
                      if (search.display)
                        authUrl.searchParams.set('display', search.display);

                      oauthUrl += `&return_url=${encodeURIComponent(
                        authUrl.toString(),
                      )}`;
                    }

                    return (
                      <a
                        key={provider.name}
                        href={oauthUrl}
                        className="btn btn-outline w-full"
                      >
                        {provider.icon_url && (
                          <img
                            src={provider.icon_url}
                            alt={provider.display_name}
                            className="mr-2 h-5 w-5"
                          />
                        )}
                        {t('oauth.loginWith', {
                          provider: provider.display_name,
                        })}
                      </a>
                    );
                  })}
                </div>
              </>
            )}

            {/* Divider */}
            <div className="divider my-2" />

            <div className="flex flex-col items-center gap-2">
              <Link
                to="/forgot-password"
                className="link link-hover link-secondary font-medium text-sm"
              >
                {t('login.link.forgotPassword')}
              </Link>
              <Link
                to="/register"
                search={extractOAuthParams(search)}
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
