import { TRButton } from '@tinyrack/ui/components/button';
import { FingerprintIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SecurityRow } from '#frontend/components/profile/security-row.tsx';

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
  const hasPasskeys = passkeyCount > 0;

  return (
    <SecurityRow
      actions={
        <TRButton
          appearance="ghost"
          intent="primary"
          onClick={() => onOpenModal(hasPasskeys ? 'manage' : 'setup')}
          type="button"
          uiSize="sm"
        >
          {hasPasskeys ? t('profile.passkey.manage') : t('profile.passkey.add')}
        </TRButton>
      }
      active={hasPasskeys}
      icon={FingerprintIcon}
      status={
        hasPasskeys
          ? t('profile.passkey.status.enabled', { count: passkeyCount })
          : t('profile.passkey.status.disabled')
      }
      title={t('profile.passkey.title')}
    />
  );
}
