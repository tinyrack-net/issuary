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
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { LoginMethodButton } from '@/components/auth/login-method-button.js';
import { LoginMethodList } from '@/components/auth/login-method-list.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { Alert } from '@/components/ui/alert.js';
import { PageLayout } from '@/components/ui/page-layout.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { appConfigQueryOptions } from '@/queries/config.js';
import { authenticateWithPasskeyMutationOptions } from '@/queries/passkey.js';
import {
  type AuthResponse,
  getSessionQueryOptions,
} from '@/queries/session.js';

const SearchSchema = OAuthSearchSchema.extend({
  oauth_error: z.string().optional(),
  oauth_error_description: z.string().optional(),
});

const OAUTH_ERROR_I18N_MAP: Record<string, string> = {
  access_denied: 'oauth.error.accessDenied',
  temporarily_unavailable: 'oauth.error.temporarilyUnavailable',
  server_error: 'oauth.error.serverError',
};

export const Route = createFileRoute('/login/')({
  component: Login,
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
  const oauthProviders = configData.oauth_authentication_methods;

  const oauthError = search.oauth_error;
  const oauthErrorMessage = oauthError
    ? t(OAUTH_ERROR_I18N_MAP[oauthError] ?? 'oauth.error.failed')
    : undefined;

  const isPasswordAuthEnabled =
    configData.basic_authentication_methods.password.enabled;
  const isPasskeyEnabled =
    configData.basic_authentication_methods.passkey.enabled;

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
    let oauthUrl = `/api/v1/oauth/${providerId}/connect?mode=login`;

    if (isOAuthFlow(search)) {
      const authUrl = buildAuthorizeUrl(search);
      oauthUrl += `&return_url=${encodeURIComponent(authUrl)}`;
    }

    return oauthUrl;
  };

  return (
    <PageLayout maxWidth="100" cardPadding>
      <PageHeader
        iconUrl={configData.app.icon_url}
        title={customTitle ?? t('login.title')}
        subtitle={customSubtitle ?? t('login.selectMethod.subtitle')}
      />

      {oauthErrorMessage && (
        <Alert type="error" icon={WarningCircleIcon} className="mb-4">
          {oauthErrorMessage}
        </Alert>
      )}

      <LoginMethodList>
        {/* OAuth Providers */}
        {oauthProviders.map((provider) => (
          <LoginMethodButton
            key={provider.id}
            providerType={provider.type}
            icon={provider.icon_url}
            label={provider.display_name}
            href={buildOAuthUrl(provider.id)}
          />
        ))}

        {/* Password Login */}
        {isPasswordAuthEnabled && (
          <LoginMethodButton
            icon={<EnvelopeSimpleIcon className="size-6" weight="regular" />}
            label={t('login.method.password')}
            to="/login/password"
            search={extractOAuthParams(search)}
          />
        )}

        {/* Passkey Login */}
        {isPasskeyEnabled && (
          <LoginMethodButton
            icon={<FingerprintIcon className="size-6" weight="regular" />}
            label={t('login.method.passkey')}
            onClick={() => passkeyLoginMutation.mutate()}
            isLoading={passkeyLoginMutation.isPending}
          />
        )}
      </LoginMethodList>

      {implicitNotice && (
        <div className="mt-6 text-center text-base-content/60 text-xs">
          <div
            className="prose prose-sm text-xs! **:text-xs!"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
            dangerouslySetInnerHTML={{ __html: implicitNotice }}
          />
        </div>
      )}
    </PageLayout>
  );
}
