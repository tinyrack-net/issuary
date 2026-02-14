import { FooterLink } from '@frontend/components/auth/footer-link.js';
import { PageHeader } from '@frontend/components/auth/page-header.js';
import { Alert } from '@frontend/components/ui/alert.js';
import { PageLayout } from '@frontend/components/ui/page-layout.js';
import { extractOAuthParams } from '@frontend/libs/oauth-search.js';
import { appConfigQueryOptions } from '@frontend/queries/config';
import { FingerprintIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

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
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('setup2fa.subtitle')}
        title={t('setup2fa.title')}
      />

      <Alert icon={ShieldCheckIcon} type="info">
        {t('setup2fa.required')}
      </Alert>

      <div className="mt-4 flex flex-col gap-4">
        {appConfig.auth.password.enabled &&
          appConfig.auth.password.totp.enabled && (
            <Link
              className="btn btn-outline btn-block justify-start gap-3"
              search={oauthParams}
              to="/setup/totp"
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

        {appConfig.auth.passkey.enabled && (
          <Link
            className="btn btn-outline btn-block justify-start gap-3"
            search={{
              ...oauthParams,
              passkey_name: 'default',
            }}
            to="/setup/passkey"
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
        linkText={t('setup2fa.backToLogin')}
        search={oauthParams}
        text=""
        to="/login"
      />
    </PageLayout>
  );
}
