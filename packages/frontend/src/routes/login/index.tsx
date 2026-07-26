import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { CircleAlertIcon, FingerprintIcon, MailIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthorizationContextBanner } from '#frontend/components/auth/authorization-context-banner.tsx';
import { LoginMethodButton } from '#frontend/components/auth/login-method-button.tsx';
import { LoginMethodList } from '#frontend/components/auth/login-method-list.tsx';
import { PageHeader } from '#frontend/components/auth/page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';
import {
  buildAuthenticatedAuthorizeUrl,
  extractOAuthParams,
  hasAuthorizationContext,
  isOAuthFlow,
  OAuthSearchSchema,
} from '#frontend/libs/oauth-search.ts';
import { classifyPasskeyError } from '#frontend/libs/passkey-error.ts';
import { tick } from '#frontend/libs/promise.ts';
import { getAuthorizationContextQueryOptions } from '#frontend/queries/authorization-context.ts';
import {
  type AppConfigs,
  appConfigQueryOptions,
} from '#frontend/queries/config.ts';
import { authenticateWithPasskeyMutationOptions } from '#frontend/queries/passkey.ts';
import {
  type AuthResponse,
  getSessionQueryOptions,
} from '#frontend/queries/session.ts';

const SearchSchema = OAuthSearchSchema.extend({
  oauth_error: z.string().optional(),
  oauth_error_description: z.string().optional(),
});

const OAUTH_ERROR_I18N_MAP: Record<string, string> = {
  access_denied: 'oauth.error.accessDenied',
  temporarily_unavailable: 'oauth.error.temporarilyUnavailable',
  server_error: 'oauth.error.serverError',
  registration_email_not_allowed: 'oauth.error.registrationEmailNotAllowed',
};

export const Route = createFileRoute('/login/')({
  component: Login,
  errorComponent: RouteErrorFallback,
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => ({
    search,
  }),
  loader: async ({ context, deps }) => {
    const config = await context.queryClient.ensureQueryData(
      appConfigQueryOptions,
    );

    if (shouldRedirectToPassword(config, deps.search)) {
      throw redirect({
        to: '/login/password',
        search: extractOAuthParams(deps.search),
        replace: true,
      });
    }

    if (hasAuthorizationContext(deps.search)) {
      await context.queryClient.ensureQueryData(
        getAuthorizationContextQueryOptions(deps.search),
      );
    }
  },
});

function shouldRedirectToPassword(
  config: AppConfigs,
  search: z.infer<typeof SearchSchema>,
): boolean {
  if (search.oauth_error) {
    return false;
  }

  return (
    config.auth.password.enabled &&
    !config.auth.passkey.enabled &&
    config.identity_providers.length === 0
  );
}

function Login() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const lang = search.lang ?? i18n.language;
  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);

  // Get implicit notice from config for OAuth signup
  const implicitNotice =
    configData.registration.signup_notice?.[lang] ??
    configData.registration.signup_notice?.[configData.i18n.fallback_language];
  const oauthProviders = configData.identity_providers;

  const oauthError = search.oauth_error;
  const oauthErrorMessage = oauthError
    ? t(OAUTH_ERROR_I18N_MAP[oauthError] ?? 'oauth.error.failed')
    : undefined;

  const isPasswordAuthEnabled = configData.auth.password.enabled;
  const isPasskeyEnabled = configData.auth.passkey.enabled;
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  // Config-based title/subtitle (overrides i18n defaults)
  const customTitle =
    configData.branding.title?.[lang] ??
    configData.branding.title?.[configData.i18n.fallback_language];
  const customSubtitle =
    configData.branding.subtitle?.[lang] ??
    configData.branding.subtitle?.[configData.i18n.fallback_language];

  const handlePasskeySuccess = async (data: AuthResponse) => {
    if (data.user) {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, data);
      await tick();

      if (isOAuthFlow(search)) {
        window.location.href = buildAuthenticatedAuthorizeUrl(search);
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
    onSuccess: (data) => {
      setPasskeyError(null);
      handlePasskeySuccess(data);
    },
    onError: (error) => {
      const reason = classifyPasskeyError(error);
      if (reason === 'unsupported') {
        setPasskeyError(t('login.passkey.error.unsupported'));
        return;
      }

      setPasskeyError(t('login.passkey.error.failed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const buildOAuthUrl = (providerId: string) => {
    let oauthUrl = `/api/oauth/${providerId}/authorize?mode=login`;

    if (isOAuthFlow(search)) {
      const authUrl = new URL(buildAuthenticatedAuthorizeUrl(search));
      const returnUrl = `${authUrl.pathname}${authUrl.search}${authUrl.hash}`;
      oauthUrl += `&return_url=${encodeURIComponent(returnUrl)}`;
    }

    return oauthUrl;
  };

  const buildPasswordLoginHref = () => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(extractOAuthParams(search))) {
      if (value !== undefined) {
        const stringValue = String(value);
        params.set(
          key,
          key === 'account_selected'
            ? decodeURIComponent(stringValue).replaceAll('"', '')
            : stringValue,
        );
      }
    }
    const query = params.toString();
    return query ? `/login/password?${query}` : '/login/password';
  };

  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        iconUrl={configData.branding.icon_url}
        subtitle={customSubtitle ?? t('login.selectMethod.subtitle')}
        title={customTitle ?? t('login.title')}
      />

      <AuthorizationContextBanner search={search} />

      {oauthErrorMessage && (
        <Alert className="mb-4" icon={CircleAlertIcon} type="error">
          {oauthErrorMessage}
        </Alert>
      )}

      {passkeyError && (
        <Alert className="mb-4" icon={CircleAlertIcon} type="error">
          {passkeyError}
        </Alert>
      )}

      <LoginMethodList>
        {/* OAuth Providers */}
        {oauthProviders.map((provider) => (
          <LoginMethodButton
            as="a"
            href={buildOAuthUrl(provider.id)}
            icon={provider.icon_url}
            key={provider.id}
            label={provider.display_name}
            providerType={provider.type}
          />
        ))}

        {/* Password Login */}
        {isPasswordAuthEnabled && (
          <LoginMethodButton
            as="a"
            href={buildPasswordLoginHref()}
            icon={<MailIcon className="size-6" />}
            label={t('login.method.password')}
          />
        )}

        {/* Passkey Login */}
        {isPasskeyEnabled && (
          <LoginMethodButton
            as="button"
            disabled={passkeyLoginMutation.isPending}
            icon={<FingerprintIcon className="size-6" />}
            isLoading={passkeyLoginMutation.isPending}
            label={t('login.method.passkey')}
            onClick={() => {
              setPasskeyError(null);
              passkeyLoginMutation.mutate();
            }}
            type="button"
          />
        )}
      </LoginMethodList>

      {implicitNotice && (
        <div className="mt-6 text-center text-tinyrack-text-muted text-tinyrack-xs">
          <div
            className="prose prose-sm text-xs! **:text-xs!"
            dangerouslySetInnerHTML={{ __html: implicitNotice }}
          />
        </div>
      )}
    </PageLayout>
  );
}
