import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  EnvelopeSimpleIcon,
  FingerprintIcon,
  LockIcon,
} from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { FooterLink } from '@/components/auth/footer-link.js';
import { IconInput } from '@/components/auth/icon-input.js';
import { OAuthButtons } from '@/components/auth/oauth-buttons.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { Divider } from '@/components/ui/divider.js';
import { PageLayout } from '@/components/ui/page-layout.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
  type SecondFactorMethod,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { appConfigQueryOptions } from '@/queries/config.js';
import { loginMutationOptions } from '@/queries/login.js';
import {
  authenticateWithPasskeyMutationOptions,
  startConditionalPasskeyAuth,
} from '@/queries/passkey.js';
import {
  type AuthResponse,
  getSessionQueryOptions,
} from '@/queries/session.js';

export const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/login/')({
  component: Login,
  validateSearch: SearchSchema,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(appConfigQueryOptions);
  },
});

function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);
  const oauthProviders = configData.oauth_authentication_methods;

  const isPasswordAuthEnabled =
    configData.basic_authentication_methods.password.enabled;
  const isPasskeyEnabled =
    configData.basic_authentication_methods.passkey.enabled;

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
    onSuccess: async (data, params) => {
      const user = data.user;

      if (user.email_verification_required && !user.email_verified) {
        router.navigate({
          to: '/verify/email',
          search: {
            email: params.email,
            ...extractOAuthParams(search),
          },
        });
        return;
      }

      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: user,
      });
      await tick();

      const registered_2fa_methods: SecondFactorMethod[] = [];
      if (
        configData.basic_authentication_methods.password.totp.enabled &&
        user.totp_registered
      ) {
        registered_2fa_methods.push('totp');
      }
      if (
        configData.basic_authentication_methods.passkey.enabled &&
        user.passkey_count > 0
      ) {
        registered_2fa_methods.push('passkey');
      }

      if (user.second_factor_required && registered_2fa_methods.length === 0) {
        if (configData.available_2fa_setup_methods.length > 1) {
          return router.navigate({
            to: '/setup/2fa',
            search: extractOAuthParams(search),
          });
        } else if (configData.available_2fa_setup_methods.length === 1) {
          const method = configData.available_2fa_setup_methods[0];
          if (method === 'totp') {
            return router.navigate({
              to: '/setup/totp',
              search: extractOAuthParams(search),
            });
          } else {
            return router.navigate({
              to: '/setup/passkey',
              search: {
                ...extractOAuthParams(search),
                passkey_name: 'default',
              },
            });
          }
        }
      }

      if (registered_2fa_methods.length > 1) {
        return router.navigate({
          to: '/verify/2fa',
          search: extractOAuthParams(search),
        });
      } else if (registered_2fa_methods.length === 1) {
        const method = registered_2fa_methods[0];
        if (method === 'totp') {
          return router.navigate({
            to: '/verify/totp',
            search: extractOAuthParams(search),
          });
        } else {
          return router.navigate({
            to: '/verify/passkey',
            search: extractOAuthParams(search),
          });
        }
      } else {
        if (isOAuthFlow(search)) {
          window.location.href = buildAuthorizeUrl(search);
        } else {
          return router.navigate({ to: '/profile' });
        }
      }
    },
    onError: (error) => {
      console.error('Login failed:', error);
      setError('email', {
        type: 'manual',
        message: t('login.error.failed'),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const handlePasskeySuccess = async (data: AuthResponse) => {
    if (data.user) {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, data);
      await tick();

      if (isOAuthFlow(search)) {
        window.location.href = buildAuthorizeUrl(search);
      } else {
        router.navigate({ to: '/profile' });
      }
    }
    queryClient.invalidateQueries({
      queryKey: getSessionQueryOptions.queryKey,
    });
  };

  const passkeyLoginMutation = useMutation({
    ...authenticateWithPasskeyMutationOptions,
    onSuccess: handlePasskeySuccess,
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  // Conditional UI: Start passkey autofill on page load
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isPasskeyEnabled || !isPasswordAuthEnabled) {
      return;
    }

    abortControllerRef.current = new AbortController();
    startConditionalPasskeyAuth(
      handlePasskeySuccess,
      abortControllerRef.current.signal,
    );

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [isPasskeyEnabled, isPasswordAuthEnabled]);

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: standardSchemaResolver(loginSchema),
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(values);
  };

  const buildOAuthUrl = (providerId: string) => {
    let oauthUrl = `/api/v1/oauth/${providerId}/connect?mode=login`;

    if (isOAuthFlow(search)) {
      const authUrl = buildAuthorizeUrl(search);
      oauthUrl += `&return_url=${encodeURIComponent(authUrl)}`;
    }

    return oauthUrl;
  };

  return (
    <PageLayout maxWidth="100" cardPadding>
      <PageHeader title={t('login.title')} subtitle={t('login.subtitle')} />

      {oauthProviders.length > 0 && (
        <>
          <OAuthButtons providers={oauthProviders} buildUrl={buildOAuthUrl} />
          {isPasswordAuthEnabled && (
            <Divider text={t('login.divider.orContinueWithEmail')} />
          )}
        </>
      )}

      {isPasswordAuthEnabled && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <IconInput
            icon={EnvelopeSimpleIcon}
            type="email"
            placeholder={t('login.email.placeholder')}
            autoComplete="username webauthn"
            error={errors.email}
            {...register('email')}
          />

          <IconInput
            icon={LockIcon}
            type="password"
            placeholder={t('login.password.placeholder')}
            autoComplete="current-password"
            error={errors.password}
            {...register('password')}
          />

          <div className="flex items-center justify-end">
            <Link to="/password/forgot" className="link text-sm">
              {t('login.link.forgotPassword')}
            </Link>
          </div>

          <SubmitButton
            isPending={loginMutation.isPending}
            pendingText={t('login.submitting')}
            className="mt-2"
          >
            {t('login.submit')}
          </SubmitButton>

          {isPasskeyEnabled && (
            <>
              <Divider text={t('login.divider.orUsePasskey')} />
              <button
                type="button"
                className="btn btn-outline btn-block"
                disabled={passkeyLoginMutation.isPending}
                onClick={() => passkeyLoginMutation.mutate()}
              >
                {passkeyLoginMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    {t('login.passkey.authenticating')}
                  </>
                ) : (
                  <>
                    <FingerprintIcon className="size-5" weight="regular" />
                    {t('login.passkey.loginWithPasskey')}
                  </>
                )}
              </button>
            </>
          )}
        </form>
      )}

      {isPasswordAuthEnabled && (
        <FooterLink
          text={t('login.footer.noAccount')}
          linkText={t('login.link.register')}
          to="/register"
          search={extractOAuthParams(search)}
        />
      )}
    </PageLayout>
  );
}
