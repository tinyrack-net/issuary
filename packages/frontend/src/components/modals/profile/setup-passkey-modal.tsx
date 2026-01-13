import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { Modal, ModalActions } from '@/components/ui/modal';
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
      size="sm"
      preventClose={isRequired}
    >
      {step === 'name' && (
        <form onSubmit={handleRegister} className="py-4">
          <p className="mb-4 text-base-content/60 text-sm">
            {t('profile.passkey.setupModal.description')}
          </p>

          {errorMessage && (
            <div className="alert alert-error mb-4">
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="form-control mb-4">
            <label className="label" htmlFor="passkey-name">
              <span className="label-text">
                {t('profile.passkey.setupModal.nameLabel')}
              </span>
            </label>
            <input
              id="passkey-name"
              type="text"
              className={`input input-bordered ${
                form.formState.errors.name ? 'input-error' : ''
              }`}
              placeholder={t('profile.passkey.setupModal.namePlaceholder')}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <span className="label-text-alt mt-1 text-error">
                {form.formState.errors.name.message}
              </span>
            )}
            <span className="label-text-alt mt-1 text-base-content/50">
              {t('profile.passkey.setupModal.nameHint')}
            </span>
          </div>

          <ModalActions>
            <button type="button" className="btn" onClick={handleClose}>
              {t('profile.passkey.setupModal.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('profile.passkey.setupModal.continue')}
            </button>
            {canSwitchToTotp && onSwitchToTotp && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={onSwitchToTotp}
              >
                {t('profile.passkey.setupModal.switchToTotp')}
              </button>
            )}
          </ModalActions>
        </form>
      )}

      {step === 'register' && (
        <div className="py-4">
          <div className="flex flex-col items-center gap-4 py-8">
            <span className="loading loading-spinner loading-lg" />
            <p className="text-center text-base-content/60 text-sm">
              {t('profile.passkey.setupModal.waitingForDevice')}
            </p>
          </div>

          <ModalActions>
            <button
              type="button"
              className="btn"
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
