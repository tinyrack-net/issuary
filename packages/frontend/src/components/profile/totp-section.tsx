import { ShieldCheckIcon } from '@phosphor-icons/react';
import { TRButton } from '@tinyrack/ui/components/button';
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
          className={`flex size-9 shrink-0 items-center justify-center rounded-tinyrack-md ${
            totpEnabled
              ? 'bg-tinyrack-success-surface'
              : 'bg-tinyrack-surface-muted'
          }`}
        >
          <ShieldCheckIcon
            className={`size-4 ${
              totpEnabled ? 'text-tinyrack-success' : 'text-tinyrack-text-muted'
            }`}
            weight="regular"
          />
        </div>
        <div>
          <div className="font-medium text-tinyrack-sm text-tinyrack-text">
            {t('profile.totp.title')}
          </div>
          <div className="text-tinyrack-text-muted text-tinyrack-xs">
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
            <TRButton
              appearance="ghost"
              data-testid="profile-totp-regenerate"
              intent="primary"
              onClick={() => onOpenModal('regenerate')}
              type="button"
              uiSize="sm"
            >
              {t('profile.totp.regenerate')}
            </TRButton>
            <TRButton
              appearance="ghost"
              data-testid="profile-totp-disable"
              intent="danger"
              onClick={() => onOpenModal('disable')}
              type="button"
              uiSize="sm"
            >
              {t('profile.totp.disable')}
            </TRButton>
          </>
        ) : (
          <TRButton
            appearance="ghost"
            data-testid="profile-totp-enable"
            intent="primary"
            onClick={() => onOpenModal('setup')}
            type="button"
            uiSize="sm"
          >
            {t('profile.totp.enable')}
          </TRButton>
        )}
      </div>
    </div>
  );
}
