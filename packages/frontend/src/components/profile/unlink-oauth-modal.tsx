import { LinkBreakIcon } from '@phosphor-icons/react';
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
      icon={LinkBreakIcon}
      isOpen={isOpen}
      onClose={handleClose}
      preventClose={isPending}
      title={t('profile.linkedAccounts.unlinkModal.title')}
      variant="destructive"
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
            className="btn btn-sm"
            data-testid="unlink-oauth-cancel"
            disabled={isPending}
            onClick={handleClose}
            type="button"
          >
            {t('profile.linkedAccounts.unlinkModal.cancel')}
          </button>
          <button
            className="btn btn-sm btn-error"
            data-testid="unlink-oauth-unlink"
            disabled={isPending}
            onClick={handleConfirm}
            type="button"
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
