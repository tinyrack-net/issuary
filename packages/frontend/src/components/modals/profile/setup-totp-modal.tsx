import { ShieldCheckIcon } from '@phosphor-icons/react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { QrStep } from '@/components/totp/qr-step.js';
import { RecoveryCodesStep } from '@/components/totp/recovery-codes-step.js';
import { useTotpSetup } from '@/components/totp/use-totp-setup.js';
import { VerifyStep } from '@/components/totp/verify-step.js';
import { AlertBanner } from '@/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@/components/ui/modal.js';

interface SetupTotpModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRequired?: boolean;
  canSwitchToPasskey?: boolean;
  onSwitchToPasskey?: () => void;
}

export function SetupTotpModal({
  isOpen,
  onClose,
  isRequired = false,
  canSwitchToPasskey = false,
  onSwitchToPasskey,
}: SetupTotpModalProps) {
  const { t } = useTranslation();

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose]);

  const {
    step,
    setupData,
    recoveryCodes,
    isSetupPending,
    isVerifyPending,
    startSetup,
    verify,
    goToVerify,
    goToQr,
    reset,
  } = useTotpSetup({
    autoStart: false,
    onRecoveryConfirm: () => {
      handleClose();
    },
  });

  // Start setup when modal opens
  const handleModalOpen = useCallback(() => {
    if (!setupData && !isSetupPending) {
      startSetup();
    }
  }, [setupData, isSetupPending, startSetup]);

  // Trigger setup on first render when open
  if (isOpen && !setupData && !isSetupPending && step !== 'error') {
    handleModalOpen();
  }

  const handleVerify = useCallback(
    async (code: string) => {
      await verify(code);
    },
    [verify],
  );

  const modalTitle =
    step === 'recovery'
      ? t('setupTotp.recoveryCodes.title')
      : t('profile.totp.setupModal.title');

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      description={
        isRequired
          ? t('profile.totp.setupModal.requiredDescription')
          : undefined
      }
      icon={ShieldCheckIcon}
      size="sm"
      preventClose={isRequired || step === 'recovery'}
    >
      {isSetupPending && (
        <div className="flex justify-center py-6">
          <span className="loading loading-spinner loading-md" />
        </div>
      )}

      {step === 'error' && (
        <div className="mt-4 space-y-3">
          <AlertBanner variant="error">
            {t('profile.totp.setupModal.setupError')}
          </AlertBanner>
          <ModalActions>
            <button type="button" className="btn btn-sm" onClick={handleClose}>
              {t('profile.totp.setupModal.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={startSetup}
            >
              {t('profile.totp.setupModal.retry')}
            </button>
          </ModalActions>
        </div>
      )}

      {setupData && step === 'qr' && (
        <div className="mt-4">
          <QrStep
            setupData={setupData}
            onNext={goToVerify}
            additionalActions={
              <>
                <ModalActions>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleClose}
                  >
                    {t('profile.totp.setupModal.cancel')}
                  </button>
                </ModalActions>
                {canSwitchToPasskey && onSwitchToPasskey && (
                  <p className="mt-2 text-center text-xs">
                    <button
                      type="button"
                      className="link link-primary"
                      onClick={onSwitchToPasskey}
                    >
                      {t('profile.totp.setupModal.switchToPasskey')}
                    </button>
                  </p>
                )}
              </>
            }
          />
        </div>
      )}

      {setupData && step === 'verify' && (
        <div className="mt-4">
          <VerifyStep
            onSubmit={handleVerify}
            onBack={goToQr}
            isPending={isVerifyPending}
          />
        </div>
      )}

      {step === 'recovery' && recoveryCodes.length > 0 && (
        <div className="mt-4">
          <RecoveryCodesStep
            recoveryCodes={recoveryCodes}
            onConfirm={handleClose}
          />
        </div>
      )}
    </Modal>
  );
}
