import { TRButton } from '@tinyrack/ui/components/button';
import { ShieldCheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SecurityRow } from '#frontend/components/profile/security-row.tsx';

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
    <SecurityRow
      actions={
        totpEnabled ? (
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
        )
      }
      active={totpEnabled}
      icon={ShieldCheckIcon}
      status={
        totpEnabled
          ? recoveryCodesMissing
            ? t('profile.totp.status.recoveryCodesMissing')
            : t('profile.totp.status.enabled')
          : t('profile.totp.status.disabled')
      }
      title={t('profile.totp.title')}
    />
  );
}
