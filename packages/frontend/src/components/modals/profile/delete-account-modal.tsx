import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
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
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.deleteAccount.modal.title')}
      preventClose={mutation.isPending}
    >
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="mb-4 rounded-lg bg-error/10 p-4">
          <p className="text-error text-sm">
            {t('profile.deleteAccount.modal.description', {
              days: retentionDays,
            })}
          </p>
          <p className="mt-2 text-error/80 text-sm">
            {t('profile.deleteAccount.modal.warning')}
          </p>
        </div>

        <div className="form-control mb-4">
          <label className="label" htmlFor="delete-confirmation">
            <span className="label-text">
              {t('profile.deleteAccount.modal.confirmLabel')}
            </span>
          </label>
          <input
            id="delete-confirmation"
            type="text"
            className={`input input-bordered ${
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
          <div className="alert alert-error mb-4">
            <span>{form.formState.errors.root.message}</span>
          </div>
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
