import { AlertBanner } from '@frontend/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@frontend/components/ui/modal.js';
import { TinyAuthError } from '@frontend/libs/error.js';
import { removePasswordMutationOptions } from '@frontend/queries/password.js';
import { getSessionQueryOptions } from '@frontend/queries/session.js';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { KeyIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';

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
      if (err instanceof TinyAuthError) {
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
        if (err.code === 'CANNOT_REMOVE_PASSWORD_WITH_SECOND_FACTOR_ONLY') {
          form.setError('root', {
            message: t('profile.password.removeModal.noOAuthWith2FA'),
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
      description={t('profile.password.removeModal.description')}
      icon={KeyIcon}
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.password.removeModal.title')}
      variant="destructive"
    >
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="form-control">
          <label className="label w-full" htmlFor="current-password-remove">
            <span className="label-text text-xs">
              {t('profile.password.removeModal.currentPassword')}
            </span>
          </label>
          <input
            className={`input input-bordered input-sm w-full ${
              form.formState.errors.currentPassword ? 'input-error' : ''
            }`}
            id="current-password-remove"
            placeholder={t(
              'profile.password.removeModal.currentPasswordPlaceholder',
            )}
            type="password"
            {...form.register('currentPassword')}
          />
          {form.formState.errors.currentPassword && (
            <span className="label-text-alt mt-0.5 text-error">
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
            className="btn btn-sm"
            disabled={mutation.isPending}
            onClick={handleClose}
            type="button"
          >
            {t('profile.password.removeModal.cancel')}
          </button>
          <button
            className="btn btn-sm btn-error"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-xs" />
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
