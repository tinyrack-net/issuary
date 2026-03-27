import { ShieldCheckIcon } from '@phosphor-icons/react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { QrStep } from '#frontend/components/totp/qr-step.tsx';
import { RecoveryCodesStep } from '#frontend/components/totp/recovery-codes-step.tsx';
import { VerifyStep } from '#frontend/components/totp/verify-step.tsx';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { useTotpSetup } from '#frontend/features/totp/use-totp-setup.ts';

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

  const {
    step,
    setupData,
    recoveryCodes,
    isSetupPending,
    isVerifyPending,
    isConfirmPending,
    startSetup,
    verify,
    goToVerify,
    goToQr,
    confirmRecoveryCodes,
    reset,
  } = useTotpSetup({
    autoStart: false,
    onConfirmSuccess: () => {
      reset();
      onClose();
    },
  });

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

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
      description={
        isRequired
          ? t('profile.totp.setupModal.requiredDescription')
          : undefined
      }
      icon={ShieldCheckIcon}
      isOpen={isOpen}
      onClose={handleClose}
      preventClose={isRequired || step === 'recovery'}
      size="sm"
      title={modalTitle}
    >
      {isSetupPending && (
        <div
          className="flex justify-center py-6"
          data-testid="setup-totp-loading"
        >
          <span className="loading loading-spinner loading-md" />
        </div>
      )}

      {step === 'error' && (
        <div className="mt-4 space-y-3">
          <AlertBanner variant="error">
            {t('profile.totp.setupModal.setupError')}
          </AlertBanner>
          <ModalActions>
            <button className="btn btn-sm" onClick={handleClose} type="button">
              {t('profile.totp.setupModal.cancel')}
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={startSetup}
              type="button"
            >
              {t('profile.totp.setupModal.retry')}
            </button>
          </ModalActions>
        </div>
      )}

      {setupData && step === 'qr' && (
        <div className="mt-4">
          <QrStep
            additionalActions={
              <>
                <ModalActions>
                  <button
                    className="btn btn-sm"
                    onClick={handleClose}
                    type="button"
                  >
                    {t('profile.totp.setupModal.cancel')}
                  </button>
                </ModalActions>
                {canSwitchToPasskey && onSwitchToPasskey && (
                  <p className="mt-2 text-center text-xs">
                    <button
                      className="link link-primary"
                      onClick={onSwitchToPasskey}
                      type="button"
                    >
                      {t('profile.totp.setupModal.switchToPasskey')}
                    </button>
                  </p>
                )}
              </>
            }
            onNext={goToVerify}
            setupData={setupData}
          />
        </div>
      )}

      {setupData && step === 'verify' && (
        <div className="mt-4">
          <VerifyStep
            isPending={isVerifyPending}
            onBack={goToQr}
            onSubmit={handleVerify}
          />
        </div>
      )}

      {step === 'recovery' && recoveryCodes.length > 0 && (
        <div className="mt-4">
          <RecoveryCodesStep
            isLoading={isConfirmPending}
            onConfirm={confirmRecoveryCodes}
            recoveryCodes={recoveryCodes}
          />
        </div>
      )}
    </Modal>
  );
}
