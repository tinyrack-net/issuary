import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { TrashIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { AlertBanner } from '@/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@/components/ui/modal.js';
import { tick } from '@/libs/promise.js';
import { deleteAccountMutationOptions } from '@/queries/account.js';
import { getSessionQueryOptions } from '@/queries/session.js';

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
        user: undefined,
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
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.deleteAccount.modal.title')}
      icon={TrashIcon}
      variant="destructive"
      preventClose={mutation.isPending}
    >
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <AlertBanner variant="error">
          <p>
            {t('profile.deleteAccount.modal.description', {
              days: retentionDays,
            })}
          </p>
          <p className="mt-1 text-xs opacity-80">
            {t('profile.deleteAccount.modal.warning')}
          </p>
        </AlertBanner>

        <div className="form-control">
          <label className="label w-full" htmlFor="delete-confirmation">
            <span className="label-text text-sm">
              {t('profile.deleteAccount.modal.confirmLabel')}
            </span>
          </label>
          <input
            id="delete-confirmation"
            type="text"
            className={`input input-bordered w-full ${
              form.formState.errors.confirmation ? 'input-error' : ''
            }`}
            placeholder={t('profile.deleteAccount.modal.confirmPlaceholder')}
            {...form.register('confirmation')}
            autoComplete="off"
          />
          {form.formState.errors.confirmation && (
            <span className="label-text-alt mt-1 text-error">
              {form.formState.errors.confirmation.message}
            </span>
          )}
        </div>

        {form.formState.errors.root && (
          <AlertBanner variant="error">
            {form.formState.errors.root.message}
          </AlertBanner>
        )}

        <ModalActions>
          <button
            type="button"
            className="btn"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            {t('profile.deleteAccount.modal.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-error"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                {t('profile.deleteAccount.modal.confirming')}
              </>
            ) : (
              t('profile.deleteAccount.modal.confirm')
            )}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
