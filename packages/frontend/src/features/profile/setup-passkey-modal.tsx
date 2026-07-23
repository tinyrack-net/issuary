import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { FingerprintIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { queryKeys } from '#frontend/queries/keys.ts';
import { registerPasskeyMutationOptions } from '#frontend/queries/passkey.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';

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
      description={
        isRequired
          ? t('profile.passkey.setupModal.requiredDescription')
          : undefined
      }
      icon={FingerprintIcon}
      isOpen={isOpen}
      onClose={handleClose}
      preventClose={isRequired}
      size="sm"
      title={t('profile.passkey.setupModal.title')}
    >
      {step === 'name' && (
        <form className="mt-4 space-y-3" onSubmit={handleRegister}>
          <p className="text-tinyrack-text-muted text-tinyrack-xs">
            {t('profile.passkey.setupModal.description')}
          </p>

          {errorMessage && (
            <AlertBanner variant="error">{errorMessage}</AlertBanner>
          )}

          <TRField.Root uiSize="sm">
            <TRField.Label htmlFor="passkey-name">
              {t('profile.passkey.setupModal.nameLabel')}
            </TRField.Label>
            <TRInput
              id="passkey-name"
              placeholder={t('profile.passkey.setupModal.namePlaceholder')}
              type="text"
              uiSize="sm"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <div className="tr-field-error" data-testid="setup-passkey-error">
                {form.formState.errors.name.message}
              </div>
            )}
            <TRField.Description>
              {t('profile.passkey.setupModal.nameHint')}
            </TRField.Description>
          </TRField.Root>

          <ModalActions>
            <TRButton
              appearance="outline"
              data-testid="setup-passkey-cancel"
              intent="neutral"
              onClick={handleClose}
              type="button"
              uiSize="sm"
            >
              {t('profile.passkey.setupModal.cancel')}
            </TRButton>
            <TRButton
              data-testid="setup-passkey-continue"
              intent="primary"
              type="submit"
              uiSize="sm"
            >
              {t('profile.passkey.setupModal.continue')}
            </TRButton>
          </ModalActions>
          {canSwitchToTotp && onSwitchToTotp && (
            <p className="mt-2 text-center text-tinyrack-xs">
              <TRButton
                appearance="ghost"
                intent="primary"
                onClick={onSwitchToTotp}
                type="button"
                uiSize="sm"
              >
                {t('profile.passkey.setupModal.switchToTotp')}
              </TRButton>
            </p>
          )}
        </form>
      )}

      {step === 'register' && (
        <div className="mt-4">
          <div
            className="flex flex-col items-center gap-3 py-6"
            data-testid="setup-passkey-loading"
          >
            <TRSpinner uiSize="md" />
            <p className="text-center text-tinyrack-text-muted text-tinyrack-xs">
              {t('profile.passkey.setupModal.waitingForDevice')}
            </p>
          </div>

          <ModalActions>
            <TRButton
              appearance="outline"
              data-testid="setup-passkey-cancel"
              disabled={isPending}
              intent="neutral"
              onClick={handleClose}
              type="button"
              uiSize="sm"
            >
              {t('profile.passkey.setupModal.cancel')}
            </TRButton>
          </ModalActions>
        </div>
      )}
    </Modal>
  );
}
