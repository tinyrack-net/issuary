import { FingerprintIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { useTranslation } from 'react-i18next';
import { FooterLink } from '#frontend/components/auth/footer-link.tsx';
import { PageHeader } from '#frontend/components/auth/page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';
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
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('setup2fa.subtitle')}
        title={t('setup2fa.title')}
      />

      <Alert icon={ShieldCheckIcon} type="info">
        {t('setup2fa.required')}
      </Alert>

      <div className="mt-4 flex flex-col gap-3">
        {appConfig.auth.password.enabled &&
          appConfig.auth.password.totp.enabled && (
            <TRLinkButton
              appearance="outline"
              className="h-auto w-full cursor-pointer justify-start gap-3 py-3"
              intent="neutral"
              render={<Link search={oauthParams} to="/setup/totp" />}
              uiSize="md"
            >
              <ShieldCheckIcon className="size-5" weight="regular" />
              <div className="flex flex-col items-start">
                <span className="font-medium">{t('setup2fa.totp.title')}</span>
                <span className="text-tinyrack-text-muted text-tinyrack-xs">
                  {t('setup2fa.totp.description')}
                </span>
              </div>
            </TRLinkButton>
          )}

        {appConfig.auth.passkey.enabled && (
          <TRLinkButton
            appearance="outline"
            className="h-auto w-full cursor-pointer justify-start gap-3 py-3"
            intent="neutral"
            render={
              <Link
                search={{
                  ...oauthParams,
                  passkey_name: 'default',
                }}
                to="/setup/passkey"
              />
            }
            uiSize="md"
          >
            <FingerprintIcon className="size-5" weight="regular" />
            <div className="flex flex-col items-start">
              <span className="font-medium">{t('setup2fa.passkey.title')}</span>
              <span className="text-tinyrack-text-muted text-tinyrack-xs">
                {t('setup2fa.passkey.description')}
              </span>
            </div>
          </TRLinkButton>
        )}
      </div>

      <FooterLink
        as={Link}
        linkText={t('setup2fa.backToLogin')}
        search={oauthParams}
        text=""
        to="/login"
      />
    </PageLayout>
  );
}
