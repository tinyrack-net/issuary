import { FingerprintIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

type PasskeyModalType = 'setup' | 'manage' | null;

interface PasskeySectionProps {
  passkeyCount: number;
  onOpenModal: (type: PasskeyModalType) => void;
}

export function PasskeySection({
  passkeyCount,
  onOpenModal,
}: PasskeySectionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            passkeyCount > 0 ? 'bg-success/10' : 'bg-base-200'
          }`}
        >
          <FingerprintIcon
            className={`size-4 ${
              passkeyCount > 0 ? 'text-success' : 'text-base-content/50'
            }`}
            weight="regular"
          />
        </div>
        <div>
          <div className="font-medium text-sm">
            {t('profile.passkey.title')}
          </div>
          <div className="text-base-content/60 text-xs">
            {passkeyCount > 0
              ? t('profile.passkey.status.enabled', { count: passkeyCount })
              : t('profile.passkey.status.disabled')}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        {passkeyCount > 0 ? (
          <button
            className="btn btn-ghost btn-xs text-primary"
            data-testid="profile-passkey-manage-btn"
            onClick={() => onOpenModal('manage')}
            type="button"
          >
            {t('profile.passkey.manage')}
          </button>
        ) : (
          <button
            className="btn btn-ghost btn-xs text-primary"
            data-testid="profile-passkey-add-btn"
            onClick={() => onOpenModal('setup')}
            type="button"
          >
            {t('profile.passkey.add')}
          </button>
        )}
      </div>
    </div>
  );
}
