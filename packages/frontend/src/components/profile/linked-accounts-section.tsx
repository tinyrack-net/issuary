import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OAuthProvider {
  id: string;
  display_name: string;
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
      <TRCard.Header className="border-tinyrack-border border-b px-4 py-3">
        <TRCard.Title className="font-semibold text-tinyrack-md text-tinyrack-text">
          {t('profile.linkedAccounts.title')}
        </TRCard.Title>
        <TRCard.Description className="text-tinyrack-text-muted text-tinyrack-xs">
          {t('profile.linkedAccounts.description')}
        </TRCard.Description>
      </TRCard.Header>
      <TRCard.Content className="divide-y divide-tinyrack-border p-0">
        {providers.map((provider) => (
          <div
            className="flex items-center justify-between p-4"
            key={provider.id}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-tinyrack-md ${
                  provider.linked
                    ? 'bg-tinyrack-success-surface'
                    : 'bg-tinyrack-surface-muted'
                }`}
              >
                <LinkIcon
                  className={`size-4 ${
                    provider.linked
                      ? 'text-tinyrack-success'
                      : 'text-tinyrack-text-muted'
                  }`}
                />
              </div>
              <div>
                <div className="font-medium text-tinyrack-sm text-tinyrack-text">
                  {provider.display_name}
                </div>
                <div className="text-tinyrack-text-muted text-tinyrack-xs">
                  {provider.linked
                    ? t('profile.linkedAccounts.connected')
                    : t('profile.linkedAccounts.notConnected')}
                </div>
              </div>
            </div>
            {provider.linked ? (
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
                  <a href={getAuthorizeUrl(provider.id, 'link', '/profile')} />
                }
                uiSize="sm"
              >
                {t('profile.linkedAccounts.link')}
              </TRLinkButton>
            )}
          </div>
        ))}
      </TRCard.Content>
    </TRCard.Root>
  );
}
