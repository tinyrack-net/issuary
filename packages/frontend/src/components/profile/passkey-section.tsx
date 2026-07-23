import { FingerprintIcon } from '@phosphor-icons/react';
import { TRButton } from '@tinyrack/ui/components/button';
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
          className={`flex size-9 shrink-0 items-center justify-center rounded-tinyrack-md ${
            passkeyCount > 0
              ? 'bg-tinyrack-success-surface'
              : 'bg-tinyrack-surface-muted'
          }`}
        >
          <FingerprintIcon
            className={`size-4 ${
              passkeyCount > 0
                ? 'text-tinyrack-success'
                : 'text-tinyrack-text-muted'
            }`}
            weight="regular"
          />
        </div>
        <div>
          <div className="font-medium text-tinyrack-sm text-tinyrack-text">
            {t('profile.passkey.title')}
          </div>
          <div className="text-tinyrack-text-muted text-tinyrack-xs">
            {passkeyCount > 0
              ? t('profile.passkey.status.enabled', { count: passkeyCount })
              : t('profile.passkey.status.disabled')}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        {passkeyCount > 0 ? (
          <TRButton
            appearance="ghost"
            intent="primary"
            onClick={() => onOpenModal('manage')}
            type="button"
            uiSize="sm"
          >
            {t('profile.passkey.manage')}
          </TRButton>
        ) : (
          <TRButton
            appearance="ghost"
            intent="primary"
            onClick={() => onOpenModal('setup')}
            type="button"
            uiSize="sm"
          >
            {t('profile.passkey.add')}
          </TRButton>
        )}
      </div>
    </div>
  );
}
