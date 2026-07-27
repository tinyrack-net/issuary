import { TRButton } from '@tinyrack/ui/components/button';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { ShieldCheckIcon } from 'lucide-react';
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

  const handleModalOpen = useCallback(() => {
    if (!setupData && !isSetupPending) {
      startSetup();
    }
  }, [setupData, isSetupPending, startSetup]);

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
          className="flex justify-center py-tinyrack-xl"
          data-testid="setup-totp-loading"
        >
          <TRSpinner uiSize="md" />
        </div>
      )}

      {step === 'error' && (
        <div className="mt-tinyrack-lg flex flex-col gap-tinyrack-md">
          <AlertBanner variant="error">
            {t('profile.totp.setupModal.setupError')}
          </AlertBanner>
          <ModalActions>
            <TRButton
              appearance="outline"
              intent="neutral"
              onClick={handleClose}
              type="button"
              uiSize="sm"
            >
              {t('profile.totp.setupModal.cancel')}
            </TRButton>
            <TRButton
              intent="primary"
              onClick={startSetup}
              type="button"
              uiSize="sm"
            >
              {t('profile.totp.setupModal.retry')}
            </TRButton>
          </ModalActions>
        </div>
      )}

      {setupData && step === 'qr' && (
        <div className="mt-tinyrack-lg">
          <QrStep
            additionalActions={
              <>
                <ModalActions>
                  <TRButton
                    appearance="outline"
                    intent="neutral"
                    onClick={handleClose}
                    type="button"
                    uiSize="sm"
                  >
                    {t('profile.totp.setupModal.cancel')}
                  </TRButton>
                </ModalActions>
                {canSwitchToPasskey && onSwitchToPasskey && (
                  <p className="mt-tinyrack-sm text-center text-tinyrack-xs">
                    <TRButton
                      appearance="ghost"
                      intent="primary"
                      onClick={onSwitchToPasskey}
                      type="button"
                      uiSize="sm"
                    >
                      {t('profile.totp.setupModal.switchToPasskey')}
                    </TRButton>
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
        <div className="mt-tinyrack-lg">
          <VerifyStep
            isPending={isVerifyPending}
            onBack={goToQr}
            onSubmit={handleVerify}
          />
        </div>
      )}

      {step === 'recovery' && recoveryCodes.length > 0 && (
        <div className="mt-tinyrack-lg">
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
