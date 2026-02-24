import { FingerprintIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { FooterLink } from '#frontend/components/auth/footer-link.js';
import { PageHeader } from '#frontend/components/auth/page-header.js';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.js';
import { PageLayout } from '#frontend/features/layout/page-layout.js';
import { extractOAuthParams } from '#frontend/libs/oauth-search.js';
import { appConfigQueryOptions } from '#frontend/queries/config.js';

export const Route = createFileRoute('/verify/2fa/')({
  component: Verify2FA,
  errorComponent: RouteErrorFallback,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(appConfigQueryOptions);
  },
});

function Verify2FA() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const oauthParams = extractOAuthParams(search);
  const { data: appConfig } = useSuspenseQuery(appConfigQueryOptions);

  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('verify2fa.subtitle')}
        title={t('verify2fa.title')}
      />

      <div className="flex flex-col gap-4">
        {appConfig.auth.password.enabled &&
          appConfig.auth.password.totp.enabled && (
            <Link
              className="btn btn-outline btn-block justify-start gap-3"
              search={oauthParams}
              to="/verify/totp"
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

        {appConfig.auth.passkey.enabled && (
          <Link
            className="btn btn-outline btn-block justify-start gap-3"
            search={oauthParams}
            to="/verify/passkey"
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
        as={Link}
        linkText={t('verify2fa.backToLogin')}
        search={oauthParams}
        text=""
        to="/login"
      />
    </PageLayout>
  );
}
