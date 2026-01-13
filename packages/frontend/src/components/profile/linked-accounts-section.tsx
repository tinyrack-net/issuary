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
  getConnectUrl: (
    providerId: string,
    mode?: 'login' | 'register' | 'link',
    returnUrl?: string,
  ) => string;
  onUnlink: (providerId: string) => void;
}

export function LinkedAccountsSection({
  providers,
  unlinkingProvider,
  getConnectUrl,
  onUnlink,
}: LinkedAccountsSectionProps) {
  const { t } = useTranslation();

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h2 className="mb-2 font-semibold text-sm">
        {t('profile.linkedAccounts.title')}
      </h2>
      <p className="mb-3 text-base-content/60 text-xs">
        {t('profile.linkedAccounts.description')}
      </p>
      <div className="rounded-lg bg-base-200 p-3">
        <div className="flex flex-col gap-2">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <LinkIcon
                  className={`size-4 ${
                    provider.linked ? 'text-success' : 'text-base-content/50'
                  }`}
                  weight="regular"
                />
                <span className="font-medium text-sm">
                  {provider.display_name}
                </span>
              </div>
              {provider.linked ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error"
                  disabled={unlinkingProvider === provider.id}
                  onClick={() => onUnlink(provider.id)}
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
                  href={getConnectUrl(provider.id, 'link', '/profile')}
                  className="btn btn-ghost btn-xs text-primary"
                >
                  {t('profile.linkedAccounts.link')}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
