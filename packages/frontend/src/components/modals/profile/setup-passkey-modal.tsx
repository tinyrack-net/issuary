import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { FingerprintIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { AlertBanner } from '@/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@/components/ui/modal.js';
import { queryKeys } from '@/queries/keys';
import { registerPasskeyMutationOptions } from '@/queries/passkey.js';
import { getSessionQueryOptions } from '@/queries/session.js';

interface SetupPasskeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRequired?: boolean;
  canSwitchToTotp?: boolean;
  onSwitchToTotp?: () => void;
}

type SetupStep = 'name' | 'register';

export function SetupPasskeyModal({
  isOpen,
  onClose,
  isRequired = false,
  canSwitchToTotp = false,
  onSwitchToTotp,
}: SetupPasskeyModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<SetupStep>('name');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .max(100, t('validation.passkey.name.max'))
          .optional()
          .transform((val) => val?.trim() || undefined),
      }),
    [t],
  );

  const form = useForm({
    resolver: standardSchemaResolver(schema),
    defaultValues: { name: '' },
  });

  const registerMutation = useMutation({
    ...registerPasskeyMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.passkeys() });
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
      handleClose();
    },
    onError: (error) => {
      setStep('name');
      if (error.name === 'NotAllowedError') {
        setErrorMessage(t('profile.passkey.setupModal.cancelled'));
      } else {
        setErrorMessage(t('profile.passkey.setupModal.error'));
      }
    },
  });

  const handleClose = useCallback(() => {
    form.reset();
    setStep('name');
    setErrorMessage(null);
    onClose();
  }, [form, onClose]);

  const handleRegister = form.handleSubmit(async (data) => {
    setStep('register');
    setErrorMessage(null);
    try {
      await registerMutation.mutateAsync({ name: data.name });
    } catch {
      // Error handling is done via mutation callbacks
    }
  });

  const isPending = registerMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.passkey.setupModal.title')}
      description={
        isRequired
          ? t('profile.passkey.setupModal.requiredDescription')
          : undefined
      }
      icon={FingerprintIcon}
      size="sm"
      preventClose={isRequired}
    >
      {step === 'name' && (
        <form onSubmit={handleRegister} className="mt-4 space-y-3">
          <p className="text-base-content/60 text-xs">
            {t('profile.passkey.setupModal.description')}
          </p>

          {errorMessage && (
            <AlertBanner variant="error">{errorMessage}</AlertBanner>
          )}

          <div className="form-control">
            <label className="label w-full" htmlFor="passkey-name">
              <span className="label-text text-xs">
                {t('profile.passkey.setupModal.nameLabel')}
              </span>
            </label>
            <input
              id="passkey-name"
              type="text"
              className={`input input-bordered input-sm w-full ${
                form.formState.errors.name ? 'input-error' : ''
              }`}
              placeholder={t('profile.passkey.setupModal.namePlaceholder')}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <span className="label-text-alt mt-0.5 text-error">
                {form.formState.errors.name.message}
              </span>
            )}
            <span className="label-text-alt mt-0.5 text-base-content/50">
              {t('profile.passkey.setupModal.nameHint')}
            </span>
          </div>

          <ModalActions>
            <button type="button" className="btn btn-sm" onClick={handleClose}>
              {t('profile.passkey.setupModal.cancel')}
            </button>
            <button type="submit" className="btn btn-sm btn-primary">
              {t('profile.passkey.setupModal.continue')}
            </button>
          </ModalActions>
          {canSwitchToTotp && onSwitchToTotp && (
            <p className="mt-2 text-center text-xs">
              <button
                type="button"
                className="link link-primary"
                onClick={onSwitchToTotp}
              >
                {t('profile.passkey.setupModal.switchToTotp')}
              </button>
            </p>
          )}
        </form>
      )}

      {step === 'register' && (
        <div className="mt-4">
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="loading loading-spinner loading-md" />
            <p className="text-center text-base-content/60 text-xs">
              {t('profile.passkey.setupModal.waitingForDevice')}
            </p>
          </div>

          <ModalActions>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleClose}
              disabled={isPending}
            >
              {t('profile.passkey.setupModal.cancel')}
            </button>
          </ModalActions>
        </div>
      )}
    </Modal>
  );
}
