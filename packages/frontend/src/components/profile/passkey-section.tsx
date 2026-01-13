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
    <div className="mb-4">
      <h2 className="mb-2 font-semibold text-sm">
        {t('profile.passkey.title')}
      </h2>
      <p className="mb-3 text-base-content/60 text-xs">
        {t('profile.passkey.description')}
      </p>
      <div className="rounded-lg bg-base-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FingerprintIcon
              className={`size-4 ${
                passkeyCount > 0 ? 'text-success' : 'text-base-content/50'
              }`}
              weight="regular"
            />
            <span className="text-sm">
              {passkeyCount > 0
                ? t('profile.passkey.status.enabled', { count: passkeyCount })
                : t('profile.passkey.status.disabled')}
            </span>
          </div>
          <div className="flex gap-1">
            {passkeyCount > 0 ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-primary"
                onClick={() => onOpenModal('manage')}
              >
                {t('profile.passkey.manage')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-primary"
                onClick={() => onOpenModal('setup')}
              >
                {t('profile.passkey.add')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
