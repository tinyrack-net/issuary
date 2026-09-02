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

type Verify2FASearch = ReturnType<typeof OAuthSearchSchema.parse>;

function Verify2FA({ search }: { search: Verify2FASearch }) {
  const { t } = useTranslation();
  const oauthParams = extractOAuthParams(search);
  const { data: appConfig } = useSuspenseQuery(appConfigQueryOptions);

  return (
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('verify2fa.subtitle')}
        title={t('verify2fa.title')}
      />

      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural method list; visible copy is owned by AuthChoiceRow. */}
      <div className="flex flex-col gap-tinyrack-sm">
        {appConfig.auth.password.enabled &&
          appConfig.auth.password.totp.enabled && (
            <AuthChoiceRow
              description={t('verify2fa.totp.description')}
              icon={ShieldCheckIcon}
              label={t('verify2fa.totp.title')}
              // No children here — the row supplies them, and an element
              // passed to `render` with children would override them.
              render={<Link to={hrefWithSearch('/verify/totp', oauthParams)} />}
            />
          )}

        {appConfig.auth.passkey.enabled && (
          <AuthChoiceRow
            description={t('verify2fa.passkey.description')}
            icon={FingerprintIcon}
            label={t('verify2fa.passkey.title')}
            render={
              <Link to={hrefWithSearch('/verify/passkey', oauthParams)} />
            }
          />
        )}
      </div>

      <AuthFooter>
        <AuthFooterLink
          link={
            <Link to={hrefWithSearch('/login', oauthParams)}>
              {t('verify2fa.backToLogin')}
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

export default function Verify2FARoute({ loaderData }: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <Verify2FA search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}
