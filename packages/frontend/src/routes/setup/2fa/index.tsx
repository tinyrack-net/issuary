import { FingerprintIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { FooterLink } from '@/components/auth/footer-link.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { Alert } from '@/components/ui/alert.js';
import { extractOAuthParams } from '@/libs/oauth-search.js';
import { appConfigQueryOptions } from '@/queries/config';

export const Route = createFileRoute('/setup/2fa/')({
  component: Setup2FA,
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
    <AuthPageLayout>
      <PageHeader
        title={t('setup2fa.title')}
        subtitle={t('setup2fa.subtitle')}
      />

      <Alert type="info" icon={ShieldCheckIcon}>
        {t('setup2fa.required')}
      </Alert>

      <div className="mt-4 flex flex-col gap-4">
        {appConfig.basic_authentication_methods.password.enabled &&
          appConfig.basic_authentication_methods.password.totp.enabled && (
            <Link
              to="/setup/totp"
              search={oauthParams}
              className="btn btn-outline btn-block justify-start gap-3"
            >
              <ShieldCheckIcon className="size-5" weight="regular" />
              <div className="flex flex-col items-start">
                <span className="font-medium">{t('setup2fa.totp.title')}</span>
                <span className="text-xs opacity-70">
                  {t('setup2fa.totp.description')}
                </span>
              </div>
            </Link>
          )}

        {appConfig.basic_authentication_methods.passkey.enabled && (
          <Link
            to="/setup/passkey"
            search={{
              ...oauthParams,
              passkey_name: 'default',
            }}
            className="btn btn-outline btn-block justify-start gap-3"
          >
            <FingerprintIcon className="size-5" weight="regular" />
            <div className="flex flex-col items-start">
              <span className="font-medium">{t('setup2fa.passkey.title')}</span>
              <span className="text-xs opacity-70">
                {t('setup2fa.passkey.description')}
              </span>
            </div>
          </Link>
        )}
      </div>

      <FooterLink
        text=""
        linkText={t('setup2fa.backToLogin')}
        to="/login"
        search={oauthParams}
      />
    </AuthPageLayout>
  );
}
