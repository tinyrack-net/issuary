import { AlertBanner } from '@frontend/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@frontend/components/ui/modal.js';
import { ApiError } from '@frontend/libs/error.js';
import { changePasswordMutationOptions } from '@frontend/queries/password.js';
import { getSessionQueryOptions } from '@frontend/queries/session.js';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { KeyIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({
  isOpen,
  onClose,
}: ChangePasswordModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t('validation.password.required')),
          newPassword: z
            .string()
            .min(6, t('validation.password.min'))
            .max(100, t('validation.password.max')),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t('validation.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  );

  const form = useForm({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const mutation = useMutation({
    ...changePasswordMutationOptions,
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
        new_password: data.newPassword,
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CURRENT_PASSWORD') {
        form.setError('currentPassword', {
          message: t('profile.password.changeModal.invalidCurrent'),
        });
      } else {
        form.setError('root', {
          message: t('profile.password.changeModal.error'),
        });
      }
    }
  });

  return (
    <Modal
      description={t('profile.password.changeModal.description')}
      icon={KeyIcon}
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.password.changeModal.title')}
    >
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="form-control">
          <label className="label w-full" htmlFor="current-password">
            <span className="label-text text-xs">
              {t('profile.password.changeModal.currentPassword')}
            </span>
          </label>
          <input
            className={`input input-bordered input-sm w-full ${
              form.formState.errors.currentPassword ? 'input-error' : ''
            }`}
            data-testid="modal-change-password-current-input"
            id="current-password"
            placeholder={t(
              'profile.password.changeModal.currentPasswordPlaceholder',
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
        <div className="form-control">
          <label className="label w-full" htmlFor="new-password-change">
            <span className="label-text text-xs">
              {t('profile.password.changeModal.newPassword')}
            </span>
          </label>
          <input
            className={`input input-bordered input-sm w-full ${
              form.formState.errors.newPassword ? 'input-error' : ''
            }`}
            data-testid="modal-change-password-new-input"
            id="new-password-change"
            placeholder={t(
              'profile.password.changeModal.newPasswordPlaceholder',
            )}
            type="password"
            {...form.register('newPassword')}
          />
          {form.formState.errors.newPassword && (
            <span className="label-text-alt mt-0.5 text-error">
              {form.formState.errors.newPassword.message}
            </span>
          )}
        </div>
        <div className="form-control">
          <label className="label w-full" htmlFor="confirm-password-change">
            <span className="label-text text-xs">
              {t('profile.password.changeModal.confirmPassword')}
            </span>
          </label>
          <input
            className={`input input-bordered input-sm w-full ${
              form.formState.errors.confirmPassword ? 'input-error' : ''
            }`}
            data-testid="modal-change-password-confirm-input"
            id="confirm-password-change"
            placeholder={t(
              'profile.password.changeModal.confirmPasswordPlaceholder',
            )}
            type="password"
            {...form.register('confirmPassword')}
          />
          {form.formState.errors.confirmPassword && (
            <span className="label-text-alt mt-0.5 text-error">
              {form.formState.errors.confirmPassword.message}
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
            data-testid="modal-change-password-cancel-btn"
            disabled={mutation.isPending}
            onClick={handleClose}
            type="button"
          >
            {t('profile.password.changeModal.cancel')}
          </button>
          <button
            className="btn btn-sm btn-primary"
            data-testid="modal-change-password-submit-btn"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                {t('profile.password.changeModal.submitting')}
              </>
            ) : (
              t('profile.password.changeModal.submit')
            )}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
