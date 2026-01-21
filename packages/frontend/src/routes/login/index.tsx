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
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { FooterLink } from '@/components/auth/footer-link.js';
import { IconInput } from '@/components/auth/icon-input.js';
import { OAuthButtons } from '@/components/auth/oauth-buttons.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { Divider } from '@/components/ui/divider.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { appConfigQueryOptions } from '@/queries/config.js';
import { loginMutationOptions } from '@/queries/login.js';
import { oauthProvidersQueryOptions } from '@/queries/oauth.js';
import { loginWithPasskeyMutationOptions } from '@/queries/passkey.js';
import { getSessionQueryOptions } from '@/queries/session.js';

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
  const search = Route.useSearch();

  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);
  const { data: oauthProvidersData } = useSuspenseQuery(
    oauthProvidersQueryOptions,
  );
  const oauthProviders = oauthProvidersData.providers;

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

      const registered_2fa_methods = [];
      if (user.totp_enabled && user.totp_registered) {
        registered_2fa_methods.push('totp');
      }
      if (user.passkey_enabled && user.passkey_count > 0) {
        registered_2fa_methods.push('passkey');
      }

      if (user.second_factor_required && registered_2fa_methods.length === 0) {
        router.navigate({
          to: '/setup/2fa',
          search: {
            ...extractOAuthParams(search),
            methods: registered_2fa_methods,
          },
        });
        return;
      }

      if (registered_2fa_methods.length > 1) {
        router.navigate({
          to: '/verify/2fa',
          search: {
            ...extractOAuthParams(search),
            methods: registered_2fa_methods,
          },
        });
        return;
      } else if (registered_2fa_methods.length === 1) {
        const method = registered_2fa_methods[0];
        if (method === 'totp') {
          router.navigate({
            to: '/verify/totp',
            search: extractOAuthParams(search),
          });
        } else {
          router.navigate({
            to: '/verify/passkey',
            search: extractOAuthParams(search),
          });
        }
      } else {
        if (isOAuthFlow(search)) {
          window.location.href = buildAuthorizeUrl(search);
        } else {
          router.navigate({ to: '/profile' });
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

  const passkeyLoginMutation = useMutation({
    ...loginWithPasskeyMutationOptions,
    onSuccess: async (data) => {
      if (data.user) {
        queryClient.setQueryData(getSessionQueryOptions.queryKey, {
          user: data.user,
        });
        await tick();

        if (isOAuthFlow(search)) {
          window.location.href = buildAuthorizeUrl(search);
        } else {
          router.navigate({ to: '/profile' });
        }
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
      email: '',
      password: '',
    },
    resolver: standardSchemaResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
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
    <AuthPageLayout>
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
            autoComplete="email"
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
            <Link to="/forgot-password" className="link text-sm">
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
    </AuthPageLayout>
  );
}
