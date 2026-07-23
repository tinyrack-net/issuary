import { LinkIcon } from '@phosphor-icons/react';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
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
      <TRCard.Header className="border-border border-b px-4 py-3">
        <TRCard.Title className="font-semibold text-sm">
          {t('profile.linkedAccounts.title')}
        </TRCard.Title>
        <TRCard.Description className="text-muted-foreground text-xs">
          {t('profile.linkedAccounts.description')}
        </TRCard.Description>
      </TRCard.Header>
      <TRCard.Content className="divide-y divide-border p-0">
        {providers.map((provider) => (
          <div
            className="flex items-center justify-between p-4"
            key={provider.id}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  provider.linked ? 'bg-success/10' : 'bg-muted'
                }`}
              >
                <LinkIcon
                  className={`size-4 ${
                    provider.linked ? 'text-success' : 'text-muted-foreground'
                  }`}
                  weight="regular"
                />
              </div>
              <div>
                <div className="font-medium text-sm">
                  {provider.display_name}
                </div>
                <div className="text-muted-foreground text-xs">
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
              <a
                className="tr-btn inline-flex cursor-pointer items-center gap-2 border-border py-1.5 text-primary text-sm"
                href={getAuthorizeUrl(provider.id, 'link', '/profile')}
              >
                {t('profile.linkedAccounts.link')}
              </a>
            )}
          </div>
        ))}
      </TRCard.Content>
    </TRCard.Root>
  );
}
