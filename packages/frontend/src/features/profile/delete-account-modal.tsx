import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { TrashIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { tick } from '#frontend/libs/promise.ts';
import { deleteAccountMutationOptions } from '#frontend/queries/account.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  retentionDays: number;
}

export function DeleteAccountModal({
  isOpen,
  onClose,
  retentionDays,
}: DeleteAccountModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const schema = useMemo(
    () =>
      z.object({
        confirmation: z
          .string()
          .refine(
            (val) =>
              val.toLowerCase() ===
              t('profile.deleteAccount.modal.confirmPlaceholder').toLowerCase(),
            { message: t('validation.confirmText.mismatch') },
          ),
      }),
    [t],
  );

  const form = useForm({
    resolver: standardSchemaResolver(schema),
    defaultValues: { confirmation: '' },
  });

  const mutation = useMutation({
    ...deleteAccountMutationOptions,
    onSuccess: async () => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: null,
      });
      await tick();
      router.navigate({ to: '/login' });
    },
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    form.reset();
    onClose();
  };

  const handleSubmit = form.handleSubmit(async () => {
    try {
      await mutation.mutateAsync();
    } catch {
      form.setError('root', {
        message: t('profile.deleteAccount.error'),
      });
    }
  });

  return (
    <Modal
      icon={TrashIcon}
      isOpen={isOpen}
      onClose={handleClose}
      preventClose={mutation.isPending}
      title={t('profile.deleteAccount.modal.title')}
      variant="destructive"
    >
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <AlertBanner variant="error">
          <p>
            {t('profile.deleteAccount.modal.description', {
              days: retentionDays,
            })}
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            {t('profile.deleteAccount.modal.warning')}
          </p>
        </AlertBanner>

        <TRField.Root uiSize="sm">
          <TRField.Label htmlFor="delete-confirmation">
            {t('profile.deleteAccount.modal.confirmLabel')}
          </TRField.Label>
          <TRInput
            autoComplete="off"
            id="delete-confirmation"
            placeholder={t('profile.deleteAccount.modal.confirmPlaceholder')}
            type="text"
            uiSize="sm"
            {...form.register('confirmation')}
          />
          {form.formState.errors.confirmation && (
            <div className="tr-field-error" data-testid="delete-account-error">
              {form.formState.errors.confirmation.message}
            </div>
          )}
        </TRField.Root>

        {form.formState.errors.root && (
          <AlertBanner variant="error">
            {form.formState.errors.root.message}
          </AlertBanner>
        )}

        <ModalActions>
          <TRButton
            data-testid="delete-account-cancel"
            disabled={mutation.isPending}
            onClick={handleClose}
            type="button"
            uiSize="sm"
          >
            {t('profile.deleteAccount.modal.cancel')}
          </TRButton>
          <TRButton
            data-testid="delete-account-submit"
            disabled={mutation.isPending}
            intent="danger"
            loading={mutation.isPending}
            loadingLabel={t('profile.deleteAccount.modal.confirming')}
            type="submit"
            uiSize="sm"
          >
            {mutation.isPending
              ? undefined
              : t('profile.deleteAccount.modal.confirm')}
          </TRButton>
        </ModalActions>
      </form>
    </Modal>
  );
}
