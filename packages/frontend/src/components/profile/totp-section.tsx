import { ShieldCheckIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

type TotpModalType = 'setup' | 'disable' | 'regenerate' | null;

interface TotpSectionProps {
  totpEnabled: boolean;
  recoveryCodesMissing: boolean;
  onOpenModal: (type: TotpModalType) => void;
}

export function TotpSection({
  totpEnabled,
  recoveryCodesMissing,
  onOpenModal,
}: TotpSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            totpEnabled ? 'bg-success/10' : 'bg-base-200'
          }`}
        >
          <ShieldCheckIcon
            className={`size-4 ${
              totpEnabled ? 'text-success' : 'text-base-content/50'
            }`}
            weight="regular"
          />
        </div>
        <div>
          <div className="font-medium text-sm">{t('profile.totp.title')}</div>
          <div className="text-base-content/60 text-xs">
            {totpEnabled
              ? recoveryCodesMissing
                ? t('profile.totp.status.recoveryCodesMissing')
                : t('profile.totp.status.enabled')
              : t('profile.totp.status.disabled')}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        {totpEnabled ? (
          <>
            <button
              className="btn btn-ghost btn-xs text-primary"
              data-testid="profile-totp-regenerate"
              onClick={() => onOpenModal('regenerate')}
              type="button"
            >
              {t('profile.totp.regenerate')}
            </button>
            <button
              className="btn btn-ghost btn-xs text-error"
              data-testid="profile-totp-disable"
              onClick={() => onOpenModal('disable')}
              type="button"
            >
              {t('profile.totp.disable')}
            </button>
          </>
        ) : (
          <button
            className="btn btn-ghost btn-xs text-primary"
            data-testid="profile-totp-enable"
            onClick={() => onOpenModal('setup')}
            type="button"
          >
            {t('profile.totp.enable')}
          </button>
        )}
      </div>
    </div>
  );
}
