import { FingerprintIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { FooterLink } from '@/components/auth/footer-link.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { Alert } from '@/components/ui/alert.js';
import { extractOAuthParams, OAuthSearchSchema } from '@/libs/oauth-search.js';

export const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/setup-2fa/')({
  component: Setup2FA,
  validateSearch: SearchSchema,
});

function Setup2FA() {
  const { t } = useTranslation();
  const search = Route.useSearch();
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
        <Link
          to="/setup-totp"
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

        <Link
          to="/setup-passkey"
          search={oauthParams}
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
      </div>

      <FooterLink
        text=""
        linkText={t('setup2fa.backToLogin')}
        to="/login"
        search={search}
      />
    </AuthPageLayout>
  );
}
