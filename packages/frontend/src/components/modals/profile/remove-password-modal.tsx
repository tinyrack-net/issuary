import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { KeyIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { AlertBanner } from '@/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@/components/ui/modal.js';
import { ApiError } from '@/libs/error.js';
import { removePasswordMutationOptions } from '@/queries/password.js';
import { getSessionQueryOptions } from '@/queries/session.js';

interface RemovePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RemovePasswordModal({
  isOpen,
  onClose,
}: RemovePasswordModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const schema = useMemo(
    () =>
      z.object({
        currentPassword: z.string().min(1, t('validation.password.required')),
      }),
    [t],
  );

  const form = useForm({
    resolver: standardSchemaResolver(schema),
    defaultValues: { currentPassword: '' },
  });

  const mutation = useMutation({
    ...removePasswordMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
      handleClose();
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await mutation.mutateAsync({
        current_password: data.currentPassword,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_CURRENT_PASSWORD') {
          form.setError('currentPassword', {
            message: t('profile.password.removeModal.invalidCurrent'),
          });
          return;
        }
        if (err.code === 'CANNOT_REMOVE_LAST_AUTH_METHOD') {
          form.setError('root', {
            message: t('profile.password.removeModal.noOAuth'),
          });
          return;
        }
      }
      form.setError('root', {
        message: t('profile.password.removeModal.error'),
      });
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.password.removeModal.title')}
      description={t('profile.password.removeModal.description')}
      icon={KeyIcon}
      variant="destructive"
    >
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="form-control">
          <label className="label w-full" htmlFor="current-password-remove">
            <span className="label-text text-sm">
              {t('profile.password.removeModal.currentPassword')}
            </span>
          </label>
          <input
            id="current-password-remove"
            type="password"
            className={`input input-bordered w-full ${
              form.formState.errors.currentPassword ? 'input-error' : ''
            }`}
            placeholder={t(
              'profile.password.removeModal.currentPasswordPlaceholder',
            )}
            {...form.register('currentPassword')}
          />
          {form.formState.errors.currentPassword && (
            <span className="label-text-alt mt-1 text-error">
              {form.formState.errors.currentPassword.message}
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
            {t('profile.password.removeModal.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-error"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                {t('profile.password.removeModal.submitting')}
              </>
            ) : (
              t('profile.password.removeModal.submit')
            )}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
