import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import {
  PASSKEYS_QUERY_KEY,
  registerPasskeyMutationOptions,
} from '@/queries/passkey.js';
import { getSessionQueryOptions } from '@/queries/session.js';

interface SetupPasskeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SetupStep = 'name' | 'register';

export function SetupPasskeyModal({ isOpen, onClose }: SetupPasskeyModalProps) {
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
      queryClient.invalidateQueries({ queryKey: PASSKEYS_QUERY_KEY });
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

  if (!isOpen) {
    return null;
  }

  const isPending = registerMutation.isPending;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg">
          {t('profile.passkey.setupModal.title')}
        </h3>

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
                <label className="label" htmlFor="passkey-name">
                  <span className="label-text-alt text-error">
                    {form.formState.errors.name.message}
                  </span>
                </label>
              )}
              <label className="label" htmlFor="passkey-name">
                <span className="label-text-alt text-base-content/50">
                  {t('profile.passkey.setupModal.nameHint')}
                </span>
              </label>
            </div>

            <div className="modal-action">
              <button type="button" className="btn" onClick={handleClose}>
                {t('profile.passkey.setupModal.cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                {t('profile.passkey.setupModal.continue')}
              </button>
            </div>
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

            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={handleClose}
                disabled={isPending}
              >
                {t('profile.passkey.setupModal.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={handleClose}>
          close
        </button>
      </form>
    </dialog>
  );
}
