import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { ShieldCheckIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RecoveryCodesStep } from '#frontend/components/totp/recovery-codes-step.tsx';
import { VerifyStep } from '#frontend/components/totp/verify-step.tsx';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal } from '#frontend/components/ui/modal.tsx';
import { TinyAuthError } from '#frontend/libs/error.ts';
import { tick } from '#frontend/libs/promise.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import {
  type RegenerateTotpRecoveryCodesResponse,
  regenerateTotpRecoveryCodesMutationOptions,
} from '#frontend/queries/totp.ts';

interface RegenerateTotpRecoveryCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RegenerateStep = 'verify' | 'recovery';

export function RegenerateTotpRecoveryCodesModal({
  isOpen,
  onClose,
}: RegenerateTotpRecoveryCodesModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: appConfig } = useSuspenseQuery(appConfigQueryOptions);
  const [step, setStep] = useState<RegenerateStep>('verify');
  const [response, setResponse] =
    useState<RegenerateTotpRecoveryCodesResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    ...regenerateTotpRecoveryCodesMutationOptions,
    onSuccess: async (data) => {
      setResponse(data);
      setStep('recovery');
      await queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const reset = useCallback(() => {
    setStep('verify');
    setResponse(null);
    setErrorMessage(null);
    mutation.reset();
  }, [mutation]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleVerify = useCallback(
    async (code: string) => {
      setErrorMessage(null);

      try {
        await mutation.mutateAsync({ code });
      } catch (error) {
        if (error instanceof TinyAuthError) {
          if (error.code === 'INVALID_TOTP_CODE') {
            throw error;
          }

          if (error.code === 'UNAUTHORIZED') {
            queryClient.setQueryData(getSessionQueryOptions.queryKey, {
              user: null,
            });
            await tick();
            router.navigate({ to: '/login' });
            return;
          }

          if (
            error.code === 'TOTP_NOT_ENABLED' ||
            error.code === 'VALIDATION_ERROR'
          ) {
            await queryClient.invalidateQueries({
              queryKey: getSessionQueryOptions.queryKey,
            });
            handleClose();
            return;
          }
        }

        setErrorMessage(t('profile.totp.regenerateModal.unexpectedError'));
      }
    },
    [handleClose, mutation, queryClient, router, t],
  );

  if (!appConfig.auth.password.totp.enabled) {
    return null;
  }

  return (
    <Modal
      description={
        step === 'verify'
          ? t('profile.totp.regenerateModal.description')
          : t('profile.totp.regenerateModal.recoveryDescription')
      }
      icon={ShieldCheckIcon}
      isOpen={isOpen}
      onClose={handleClose}
      preventClose={step === 'recovery'}
      size="sm"
      title={
        step === 'verify'
          ? t('profile.totp.regenerateModal.title')
          : t('profile.totp.regenerateModal.recoveryTitle')
      }
    >
      {step === 'verify' ? (
        <div className="mt-4">
          {errorMessage && (
            <div className="mb-3">
              <AlertBanner variant="error">{errorMessage}</AlertBanner>
            </div>
          )}
          <VerifyStep
            invalidMessage={t('profile.totp.regenerateModal.error')}
            isPending={mutation.isPending}
            onSubmit={handleVerify}
            pendingText={t('profile.totp.regenerateModal.submitting')}
            submitLabel={t('profile.totp.regenerateModal.submit')}
          />
        </div>
      ) : (
        <div className="mt-4">
          <RecoveryCodesStep
            onConfirm={handleClose}
            recoveryCodes={response?.recovery_codes ?? []}
          />
        </div>
      )}
    </Modal>
  );
}
