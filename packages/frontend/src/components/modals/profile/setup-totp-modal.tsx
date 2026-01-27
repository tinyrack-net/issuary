import { ShieldCheckIcon } from '@phosphor-icons/react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { QrStep } from '@/components/totp/qr-step.js';
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
    isSetupPending,
    isVerifyPending,
    startSetup,
    verify,
    goToVerify,
    goToQr,
    reset,
  } = useTotpSetup({
    autoStart: false,
    onVerifySuccess: () => {
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.totp.setupModal.title')}
      description={
        isRequired
          ? t('profile.totp.setupModal.requiredDescription')
          : undefined
      }
      icon={ShieldCheckIcon}
      size="sm"
      preventClose={isRequired}
    >
      {isSetupPending && (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {step === 'error' && (
        <div className="mt-6 space-y-4">
          <AlertBanner variant="error">
            {t('profile.totp.setupModal.setupError')}
          </AlertBanner>
          <ModalActions>
            <button type="button" className="btn" onClick={handleClose}>
              {t('profile.totp.setupModal.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={startSetup}
            >
              {t('profile.totp.setupModal.retry')}
            </button>
          </ModalActions>
        </div>
      )}

      {setupData && step === 'qr' && (
        <div className="mt-6">
          <QrStep
            setupData={setupData}
            onNext={goToVerify}
            additionalActions={
              <>
                <ModalActions>
                  <button type="button" className="btn" onClick={handleClose}>
                    {t('profile.totp.setupModal.cancel')}
                  </button>
                </ModalActions>
                {canSwitchToPasskey && onSwitchToPasskey && (
                  <p className="mt-3 text-center text-sm">
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
        <div className="mt-6">
          <VerifyStep
            onSubmit={handleVerify}
            onBack={goToQr}
            isPending={isVerifyPending}
          />
        </div>
      )}
    </Modal>
  );
}
