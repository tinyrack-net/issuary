import { LinkIcon } from '@phosphor-icons/react';
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
    <div className="rounded-xl border border-base-200">
      <div className="border-base-200 border-b px-4 py-3">
        <h2 className="font-semibold text-sm">
          {t('profile.linkedAccounts.title')}
        </h2>
        <p className="text-base-content/60 text-xs">
          {t('profile.linkedAccounts.description')}
        </p>
      </div>
      <div className="divide-y divide-base-200">
        {providers.map((provider) => (
          <div
            className="flex items-center justify-between p-4"
            key={provider.id}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  provider.linked ? 'bg-success/10' : 'bg-base-200'
                }`}
              >
                <LinkIcon
                  className={`size-4 ${
                    provider.linked ? 'text-success' : 'text-base-content/50'
                  }`}
                  weight="regular"
                />
              </div>
              <div>
                <div className="font-medium text-sm">
                  {provider.display_name}
                </div>
                <div className="text-base-content/60 text-xs">
                  {provider.linked
                    ? t('profile.linkedAccounts.connected')
                    : t('profile.linkedAccounts.notConnected')}
                </div>
              </div>
            </div>
            {provider.linked ? (
              <button
                className="btn btn-ghost btn-xs text-error"
                disabled={unlinkingProvider === provider.id}
                onClick={() => onUnlinkRequest(provider)}
                type="button"
              >
                {unlinkingProvider === provider.id ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    {t('profile.linkedAccounts.unlinking')}
                  </>
                ) : (
                  t('profile.linkedAccounts.unlink')
                )}
              </button>
            ) : (
              <a
                className="btn btn-ghost btn-xs text-primary"
                href={getAuthorizeUrl(provider.id, 'link', '/profile')}
              >
                {t('profile.linkedAccounts.link')}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
