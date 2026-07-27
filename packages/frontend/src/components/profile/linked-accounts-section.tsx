import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { useTranslation } from 'react-i18next';
import { ProviderMark } from '#frontend/components/auth/provider-logos.tsx';
import { SecurityRow } from '#frontend/components/profile/security-row.tsx';

interface OAuthProvider {
  id: string;
  display_name: string;
  icon_url?: string;
  linked: boolean;
}

interface LinkedAccountsSectionProps {
  providers: OAuthProvider[];
  unlinkingProvider: string | null;
  getAuthorizeUrl: (
    providerId: string,
    mode?: 'login' | 'register' | 'link',
    returnUrl?: string,
  ) => string;
  onUnlinkRequest: (provider: OAuthProvider) => void;
}

export function LinkedAccountsSection({
  providers,
  unlinkingProvider,
  getAuthorizeUrl,
  onUnlinkRequest,
}: LinkedAccountsSectionProps) {
  const { t } = useTranslation();

  if (providers.length === 0) {
    return null;
  }

  return (
    <TRCard.Root variant="outlined">
      <TRCard.Header className="border-tinyrack-border border-b px-tinyrack-lg py-tinyrack-md">
        <TRCard.Title>{t('profile.linkedAccounts.title')}</TRCard.Title>
        <TRCard.Description>
          {t('profile.linkedAccounts.description')}
        </TRCard.Description>
      </TRCard.Header>
      <TRCard.Content className="divide-y divide-tinyrack-border p-0">
        {providers.map((provider) => (
          <SecurityRow
            actions={
              provider.linked ? (
                <TRButton
                  appearance="ghost"
                  intent="danger"
                  loading={unlinkingProvider === provider.id}
                  loadingLabel={t('profile.linkedAccounts.unlinking')}
                  onClick={() => onUnlinkRequest(provider)}
                  type="button"
                  uiSize="sm"
                >
                  {unlinkingProvider !== provider.id
                    ? t('profile.linkedAccounts.unlink')
                    : undefined}
                </TRButton>
              ) : (
                <TRLinkButton
                  appearance="outline"
                  intent="neutral"
                  render={
                    <a
                      href={getAuthorizeUrl(provider.id, 'link', '/profile')}
                    />
                  }
                  uiSize="sm"
                >
                  {t('profile.linkedAccounts.link')}
                </TRLinkButton>
              )
            }
            active={provider.linked}
            /*
              The real brand mark, not a generic link glyph. The sign-in screen
              shows the Google logo; showing a chain link for the same provider
              on a screen the user reaches minutes later reads as a different
              product.
            */
            icon={
              <ProviderMark
                className="size-4"
                iconUrl={provider.icon_url}
                providerId={provider.id}
              />
            }
            key={provider.id}
            status={
              provider.linked
                ? t('profile.linkedAccounts.connected')
                : t('profile.linkedAccounts.notConnected')
            }
            title={provider.display_name}
          />
        ))}
      </TRCard.Content>
    </TRCard.Root>
  );
}
