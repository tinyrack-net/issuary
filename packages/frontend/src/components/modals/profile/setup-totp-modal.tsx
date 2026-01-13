import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { Modal, ModalActions } from '@/components/ui/modal';
import { queryKeys } from '@/queries/keys';
import { getSessionQueryOptions } from '@/queries/session.js';
import {
  startTotpSetupMutationOptions,
  type TotpSetupResponse,
  verifyTotpMutationOptions,
} from '@/queries/totp.js';

interface SetupTotpModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRequired?: boolean;
  canSwitchToPasskey?: boolean;
  onSwitchToPasskey?: () => void;
}

type SetupStep = 'qr' | 'verify';

export function SetupTotpModal({
  isOpen,
  onClose,
  isRequired = false,
  canSwitchToPasskey = false,
  onSwitchToPasskey,
}: SetupTotpModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<SetupStep>('qr');
  const [setupData, setSetupData] = useState<TotpSetupResponse | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .length(6, t('validation.totp.length'))
          .regex(/^\d{6}$/, t('validation.totp.digits')),
      }),
    [t],
  );

  const form = useForm({
    resolver: standardSchemaResolver(schema),
    defaultValues: { code: '' },
  });

  const setupMutation = useMutation({
    ...startTotpSetupMutationOptions,
    onSuccess: (data) => {
      setSetupData(data);
      setStep('qr');
    },
  });

  const verifyMutation = useMutation({
    ...verifyTotpMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.totp() });
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
      handleClose();
    },
  });

  const handleClose = useCallback(() => {
    form.reset();
    setStep('qr');
    setSetupData(null);
    onClose();
  }, [form, onClose]);

  const handleStartSetup = useCallback(async () => {
    try {
      await setupMutation.mutateAsync();
    } catch {
      // Error handling is done via mutation state
    }
  }, [setupMutation]);

  const handleVerify = form.handleSubmit(async (data) => {
    try {
      await verifyMutation.mutateAsync({ code: data.code });
    } catch {
      form.setError('code', {
        message: t('profile.totp.setupModal.verifyError'),
      });
    }
  });

  // Start setup when modal opens
  const handleModalOpen = useCallback(() => {
    if (!setupData && !setupMutation.isPending) {
      handleStartSetup();
    }
  }, [setupData, setupMutation.isPending, handleStartSetup]);

  // Trigger setup on first render when open
  if (
    isOpen &&
    !setupData &&
    !setupMutation.isPending &&
    !setupMutation.isError
  ) {
    handleModalOpen();
  }

  const isPending = setupMutation.isPending || verifyMutation.isPending;

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
      size="sm"
      preventClose={isRequired}
    >
      {setupMutation.isPending && (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {setupMutation.isError && (
        <div className="py-4">
          <div className="alert alert-error">
            <span>{t('profile.totp.setupModal.setupError')}</span>
          </div>
          <ModalActions>
            <button type="button" className="btn" onClick={handleClose}>
              {t('profile.totp.setupModal.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartSetup}
            >
              {t('profile.totp.setupModal.retry')}
            </button>
          </ModalActions>
        </div>
      )}

      {setupData && step === 'qr' && (
        <div className="py-4">
          <p className="mb-4 text-base-content/60 text-sm">
            {t('profile.totp.setupModal.qrDescription')}
          </p>

          <div className="mb-4 flex justify-center">
            <img
              src={setupData.qr_code}
              alt="TOTP QR Code"
              className="h-48 w-48 rounded-lg border"
            />
          </div>

          <div className="collapse-arrow collapse bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title font-medium text-sm">
              {t('profile.totp.setupModal.manualEntry')}
            </div>
            <div className="collapse-content">
              <code className="block break-all rounded bg-base-300 p-2 text-xs">
                {setupData.secret}
              </code>
            </div>
          </div>

          <ModalActions>
            <button type="button" className="btn" onClick={handleClose}>
              {t('profile.totp.setupModal.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep('verify')}
            >
              {t('profile.totp.setupModal.next')}
            </button>
            {canSwitchToPasskey && onSwitchToPasskey && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={onSwitchToPasskey}
              >
                {t('profile.totp.setupModal.switchToPasskey')}
              </button>
            )}
          </ModalActions>
        </div>
      )}

      {setupData && step === 'verify' && (
        <form onSubmit={handleVerify} className="py-4">
          <p className="mb-4 text-base-content/60 text-sm">
            {t('profile.totp.setupModal.verifyDescription')}
          </p>

          <div className="form-control mb-4">
            <label className="label" htmlFor="totp-code">
              <span className="label-text">
                {t('profile.totp.setupModal.codeLabel')}
              </span>
            </label>
            <input
              id="totp-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className={`input input-bordered text-center text-2xl tracking-widest ${
                form.formState.errors.code ? 'input-error' : ''
              }`}
              placeholder="000000"
              autoComplete="one-time-code"
              {...form.register('code')}
            />
            {form.formState.errors.code && (
              <span className="label-text-alt mt-1 text-error">
                {form.formState.errors.code.message}
              </span>
            )}
          </div>

          <ModalActions>
            <button
              type="button"
              className="btn"
              onClick={() => setStep('qr')}
              disabled={isPending}
            >
              {t('profile.totp.setupModal.back')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
            >
              {verifyMutation.isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  {t('profile.totp.setupModal.verifying')}
                </>
              ) : (
                t('profile.totp.setupModal.verify')
              )}
            </button>
          </ModalActions>
        </form>
      )}
    </Modal>
  );
}
