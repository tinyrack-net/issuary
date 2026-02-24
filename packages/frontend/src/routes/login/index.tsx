import {
  EnvelopeSimpleIcon,
  FingerprintIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { LoginMethodButton } from '#frontend/components/auth/login-method-button.js';
import { LoginMethodList } from '#frontend/components/auth/login-method-list.js';
import { PageHeader } from '#frontend/components/auth/page-header.js';
import { Alert } from '#frontend/components/ui/alert.js';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.js';
import { PageLayout } from '#frontend/features/layout/page-layout.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '#frontend/libs/oauth-search.js';
import { tick } from '#frontend/libs/promise.js';
import { appConfigQueryOptions } from '#frontend/queries/config.js';
import { authenticateWithPasskeyMutationOptions } from '#frontend/queries/passkey.js';
import {
  type AuthResponse,
  getSessionQueryOptions,
} from '#frontend/queries/session.js';

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
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(appConfigQueryOptions);
  },
});

function Login() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const lang = search.lang ?? i18n.language;
  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);

  // Get implicit notice from config for OAuth signup
  const implicitNotice =
    configData.app.signup_implicit_terms?.[lang] ??
    configData.app.signup_implicit_terms?.[configData.app.fallback_language];
  const oauthProviders = configData.identity_providers;

  const oauthError = search.oauth_error;
  const oauthErrorMessage = oauthError
    ? t(OAUTH_ERROR_I18N_MAP[oauthError] ?? 'oauth.error.failed')
    : undefined;

  const isPasswordAuthEnabled = configData.auth.password.enabled;
  const isPasskeyEnabled = configData.auth.passkey.enabled;

  // Config-based title/subtitle (overrides i18n defaults)
  const customTitle =
    configData.app.title?.[lang] ??
    configData.app.title?.[configData.app.fallback_language];
  const customSubtitle =
    configData.app.subtitle?.[lang] ??
    configData.app.subtitle?.[configData.app.fallback_language];

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

  const buildOAuthUrl = (providerId: string) => {
    let oauthUrl = `/api/oauth/${providerId}/authorize?mode=login`;

    if (isOAuthFlow(search)) {
      const authUrl = buildAuthorizeUrl(search);
      oauthUrl += `&return_url=${encodeURIComponent(authUrl)}`;
    }

    return oauthUrl;
  };

  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        iconUrl={configData.app.icon_url}
        subtitle={customSubtitle ?? t('login.selectMethod.subtitle')}
        title={customTitle ?? t('login.title')}
      />

      {oauthErrorMessage && (
        <Alert className="mb-4" icon={WarningCircleIcon} type="error">
          {oauthErrorMessage}
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
            as={Link}
            icon={<EnvelopeSimpleIcon className="size-6" weight="regular" />}
            label={t('login.method.password')}
            search={extractOAuthParams(search)}
            to="/login/password"
          />
        )}

        {/* Passkey Login */}
        {isPasskeyEnabled && (
          <LoginMethodButton
            as="button"
            disabled={passkeyLoginMutation.isPending}
            icon={<FingerprintIcon className="size-6" weight="regular" />}
            isLoading={passkeyLoginMutation.isPending}
            label={t('login.method.passkey')}
            onClick={() => passkeyLoginMutation.mutate()}
            type="button"
          />
        )}
      </LoginMethodList>

      {implicitNotice && (
        <div className="mt-6 text-center text-base-content/60 text-xs">
          <div
            className="prose prose-sm text-xs! **:text-xs!"
            dangerouslySetInnerHTML={{ __html: implicitNotice }}
          />
        </div>
      )}
    </PageLayout>
  );
}
