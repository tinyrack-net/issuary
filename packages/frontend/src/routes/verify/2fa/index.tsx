import { FingerprintIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { FooterLink } from '@/components/auth/footer-link.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { extractOAuthParams } from '@/libs/oauth-search.js';
import { appConfigQueryOptions } from '@/queries/config';

export const Route = createFileRoute('/verify/2fa/')({
  component: Verify2FA,
});

function Verify2FA() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const oauthParams = extractOAuthParams(search);
  const { data: appConfig } = useSuspenseQuery(appConfigQueryOptions);

  return (
    <AuthPageLayout>
      <PageHeader
        title={t('verify2fa.title')}
        subtitle={t('verify2fa.subtitle')}
      />

      <div className="flex flex-col gap-4">
        {appConfig.basic_authentication_methods.password.enabled &&
          appConfig.basic_authentication_methods.password.totp.enabled && (
            <Link
              to="/verify/totp"
              search={oauthParams}
              className="btn btn-outline btn-block justify-start gap-3"
            >
              <ShieldCheckIcon className="size-5" weight="regular" />
              <div className="flex flex-col items-start">
                <span className="font-medium">{t('verify2fa.totp.title')}</span>
                <span className="text-xs opacity-70">
                  {t('verify2fa.totp.description')}
                </span>
              </div>
            </Link>
          )}

        {appConfig.basic_authentication_methods.passkey.enabled && (
          <Link
            to="/verify/passkey"
            search={oauthParams}
            className="btn btn-outline btn-block justify-start gap-3"
          >
            <FingerprintIcon className="size-5" weight="regular" />
            <div className="flex flex-col items-start">
              <span className="font-medium">
                {t('verify2fa.passkey.title')}
              </span>
              <span className="text-xs opacity-70">
                {t('verify2fa.passkey.description')}
              </span>
            </div>
          </Link>
        )}
      </div>

      <FooterLink
        text=""
        linkText={t('verify2fa.backToLogin')}
        to="/login"
        search={oauthParams}
      />
    </AuthPageLayout>
  );
}
