import { ShieldCheckIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

type TotpModalType = 'setup' | 'disable' | null;

interface TotpSectionProps {
  totpEnabled: boolean;
  onOpenModal: (type: TotpModalType) => void;
}

export function TotpSection({ totpEnabled, onOpenModal }: TotpSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-4">
      <h2 className="mb-2 font-semibold text-sm">{t('profile.totp.title')}</h2>
      <p className="mb-3 text-base-content/60 text-xs">
        {t('profile.totp.description')}
      </p>
      <div className="rounded-lg bg-base-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon
              className={`size-4 ${
                totpEnabled ? 'text-success' : 'text-base-content/50'
              }`}
              weight="regular"
            />
            <span className="text-sm">
              {totpEnabled
                ? t('profile.totp.status.enabled')
                : t('profile.totp.status.disabled')}
            </span>
          </div>
          <div className="flex gap-1">
            {totpEnabled ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-error"
                onClick={() => onOpenModal('disable')}
              >
                {t('profile.totp.disable')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-primary"
                onClick={() => onOpenModal('setup')}
              >
                {t('profile.totp.enable')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
