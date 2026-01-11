import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
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
      const errorCode = (err as { code?: string })?.code;
      if (errorCode === 'INVALID_CURRENT_PASSWORD') {
        form.setError('currentPassword', {
          message: t('profile.password.removeModal.invalidCurrent'),
        });
      } else if (errorCode === 'CANNOT_REMOVE_LAST_AUTH_METHOD') {
        form.setError('root', {
          message: t('profile.password.removeModal.noOAuth'),
        });
      } else {
        form.setError('root', {
          message: t('profile.password.removeModal.error'),
        });
      }
    }
  });

  if (!isOpen) {
    return null;
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">
          {t('profile.password.removeModal.title')}
        </h3>
        <p className="py-2 text-base-content/60 text-sm">
          {t('profile.password.removeModal.description')}
        </p>
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="form-control mb-4">
            <label className="label" htmlFor="current-password-remove">
              <span className="label-text">
                {t('profile.password.removeModal.currentPassword')}
              </span>
            </label>
            <input
              id="current-password-remove"
              type="password"
              className={`input input-bordered ${
                form.formState.errors.currentPassword ? 'input-error' : ''
              }`}
              placeholder={t(
                'profile.password.removeModal.currentPasswordPlaceholder',
              )}
              {...form.register('currentPassword')}
            />
            {form.formState.errors.currentPassword && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {form.formState.errors.currentPassword.message}
                </span>
              </label>
            )}
          </div>
          {form.formState.errors.root && (
            <div className="alert alert-error mb-4">
              <span>{form.formState.errors.root.message}</span>
            </div>
          )}
          <div className="modal-action">
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
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={handleClose}>
          close
        </button>
      </form>
    </dialog>
  );
}
