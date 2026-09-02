import { useSuspenseQuery } from '@tanstack/react-query';
import { FingerprintIcon, ShieldCheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AuthChoiceRow } from '#frontend/components/auth/auth-choice-row.tsx';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import {
  extractOAuthParams,
  OAuthSearchSchema,
} from '#frontend/libs/oauth-search.ts';
import {
  createRouteLoaderData,
  hrefWithSearch,
  NativeRouteErrorBoundary,
  parseRequestSearch,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { Route } from './+types/route.js';

type Setup2FASearch = ReturnType<typeof OAuthSearchSchema.parse>;

function Setup2FA({ search }: { search: Setup2FASearch }) {
  const { t } = useTranslation();
  const { data: appConfig } = useSuspenseQuery(appConfigQueryOptions);
  const oauthParams = extractOAuthParams(search);

  return (
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('setup2fa.subtitle')}
        title={t('setup2fa.title')}
      />

      <Alert icon={ShieldCheckIcon} type="info">
        {t('setup2fa.required')}
      </Alert>

      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural method list; visible copy is owned by AuthChoiceRow. */}
      <div className="flex flex-col gap-tinyrack-sm">
        {appConfig.auth.password.enabled &&
          appConfig.auth.password.totp.enabled && (
            <AuthChoiceRow
              description={t('setup2fa.totp.description')}
              icon={ShieldCheckIcon}
              label={t('setup2fa.totp.title')}
              // No children here — the row supplies them, and an element
              // passed to `render` with children would override them.
              render={<Link to={hrefWithSearch('/setup/totp', oauthParams)} />}
            />
          )}

        {appConfig.auth.passkey.enabled && (
          <AuthChoiceRow
            description={t('setup2fa.passkey.description')}
            icon={FingerprintIcon}
            label={t('setup2fa.passkey.title')}
            render={
              <Link
                to={hrefWithSearch('/setup/passkey', {
                  ...oauthParams,
                  passkey_name: 'default',
                })}
              />
            }
          />
        )}
      </div>

      <AuthFooter>
        <AuthFooterLink
          link={
            <Link to={hrefWithSearch('/login', oauthParams)}>
              {t('setup2fa.backToLogin')}
            </Link>
          }
        />
      </AuthFooter>
    </AuthLayout>
  );
}

export function loader({ request, context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  return createRouteLoaderData(
    runtime.queryClient,
    parseRequestSearch(request, OAuthSearchSchema),
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <NativeRouteErrorBoundary component={RouteErrorFallback} error={error} />
  );
}

export default function Setup2FARoute({ loaderData }: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <Setup2FA search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}
