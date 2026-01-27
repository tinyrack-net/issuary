import { LinkBreakIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertBanner } from '@/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@/components/ui/modal.js';

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
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.linkedAccounts.unlinkModal.title')}
      description={t('profile.linkedAccounts.unlinkModal.description', {
        provider: providerName,
      })}
      icon={LinkBreakIcon}
      variant="destructive"
      preventClose={isPending}
    >
      <div className="mt-4 space-y-3">
        <AlertBanner variant="warning">
          {t('profile.linkedAccounts.unlinkModal.warning', {
            provider: providerName,
          })}
        </AlertBanner>

        {error && <AlertBanner variant="error">{error}</AlertBanner>}

        <ModalActions>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleClose}
            disabled={isPending}
          >
            {t('profile.linkedAccounts.unlinkModal.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-error"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                {t('profile.linkedAccounts.unlinking')}
              </>
            ) : (
              t('profile.linkedAccounts.unlink')
            )}
          </button>
        </ModalActions>
      </div>
    </Modal>
  );
}
