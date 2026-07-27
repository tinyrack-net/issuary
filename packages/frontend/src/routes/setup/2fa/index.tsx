import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FingerprintIcon, ShieldCheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthChoiceRow } from '#frontend/components/auth/auth-choice-row.tsx';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import { extractOAuthParams } from '#frontend/libs/oauth-search.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';

export const Route = createFileRoute('/setup/2fa/')({
  component: Setup2FA,
  errorComponent: RouteErrorFallback,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(appConfigQueryOptions);
  },
});

function Setup2FA() {
  const { t } = useTranslation();
  const search = Route.useSearch();
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

      <div className="flex flex-col gap-tinyrack-sm">
        {appConfig.auth.password.enabled &&
          appConfig.auth.password.totp.enabled && (
            <AuthChoiceRow
              description={t('setup2fa.totp.description')}
              icon={ShieldCheckIcon}
              label={t('setup2fa.totp.title')}
              // No children here — the row supplies them, and an element
              // passed to `render` with children would override them.
              render={<Link search={oauthParams} to="/setup/totp" />}
            />
          )}

        {appConfig.auth.passkey.enabled && (
          <AuthChoiceRow
            description={t('setup2fa.passkey.description')}
            icon={FingerprintIcon}
            label={t('setup2fa.passkey.title')}
            render={
              <Link
                search={{
                  ...oauthParams,
                  passkey_name: 'default',
                }}
                to="/setup/passkey"
              />
            }
          />
        )}
      </div>

      <AuthFooter>
        <AuthFooterLink
          link={
            <Link search={oauthParams} to="/login">
              {t('setup2fa.backToLogin')}
            </Link>
          }
        />
      </AuthFooter>
    </AuthLayout>
  );
}
