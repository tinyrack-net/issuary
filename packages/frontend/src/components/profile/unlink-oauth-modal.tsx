import { TRButton } from '@tinyrack/ui/components/button';
import { Link2OffIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';

interface UnlinkOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerName: string;
  isPending: boolean;
  onConfirm: () => Promise<void>;
}

export function UnlinkOAuthModal({
  isOpen,
  onClose,
  providerName,
  isPending,
  onConfirm,
}: UnlinkOAuthModalProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isPending) return;
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm();
      handleClose();
    } catch {
      setError(t('profile.linkedAccounts.unlinkError'));
    }
  };

  return (
    <Modal
      description={t('profile.linkedAccounts.unlinkModal.description', {
        provider: providerName,
      })}
      icon={Link2OffIcon}
      isOpen={isOpen}
      onClose={handleClose}
      preventClose={isPending}
      title={t('profile.linkedAccounts.unlinkModal.title')}
      variant="destructive"
    >
      <div className="mt-tinyrack-lg flex flex-col gap-tinyrack-md">
        <AlertBanner variant="warning">
          {t('profile.linkedAccounts.unlinkModal.warning', {
            provider: providerName,
          })}
        </AlertBanner>

        {error && <AlertBanner variant="error">{error}</AlertBanner>}

        <ModalActions>
          <TRButton
            appearance="outline"
            data-testid="unlink-oauth-cancel"
            disabled={isPending}
            intent="neutral"
            onClick={handleClose}
            type="button"
            uiSize="sm"
          >
            {t('profile.linkedAccounts.unlinkModal.cancel')}
          </TRButton>
          <TRButton
            data-testid="unlink-oauth-unlink"
            disabled={isPending}
            intent="danger"
            loading={isPending}
            loadingLabel={t('profile.linkedAccounts.unlinking')}
            onClick={handleConfirm}
            type="button"
            uiSize="sm"
          >
            {t('profile.linkedAccounts.unlink')}
          </TRButton>
        </ModalActions>
      </div>
    </Modal>
  );
}
