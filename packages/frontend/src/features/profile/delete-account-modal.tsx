import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { TrashIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';
import { AlertBanner } from '#frontend/components/ui/alert-banner.js';
import { Modal, ModalActions } from '#frontend/components/ui/modal.js';
import { tick } from '#frontend/libs/promise.js';
import { deleteAccountMutationOptions } from '#frontend/queries/account.js';
import { getSessionQueryOptions } from '#frontend/queries/session.js';

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

        <div className="form-control">
          <label className="label w-full" htmlFor="delete-confirmation">
            <span className="label-text text-xs">
              {t('profile.deleteAccount.modal.confirmLabel')}
            </span>
          </label>
          <input
            className={`input input-bordered input-sm w-full ${
              form.formState.errors.confirmation ? 'input-error' : ''
            }`}
            id="delete-confirmation"
            placeholder={t('profile.deleteAccount.modal.confirmPlaceholder')}
            type="text"
            {...form.register('confirmation')}
            autoComplete="off"
          />
          {form.formState.errors.confirmation && (
            <span
              className="label-text-alt mt-0.5 text-error"
              data-testid="delete-account-error"
            >
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
            className="btn btn-sm"
            data-testid="delete-account-cancel"
            disabled={mutation.isPending}
            onClick={handleClose}
            type="button"
          >
            {t('profile.deleteAccount.modal.cancel')}
          </button>
          <button
            className="btn btn-sm btn-error"
            data-testid="delete-account-submit"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-xs" />
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
