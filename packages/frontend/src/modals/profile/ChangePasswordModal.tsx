import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { changePasswordMutationOptions } from '@/queries/password.js';
import { getSessionQueryOptions } from '@/queries/session.js';

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
      const errorCode = (err as { code?: string })?.code;
      if (errorCode === 'INVALID_CURRENT_PASSWORD') {
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

  if (!isOpen) {
    return null;
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">
          {t('profile.password.changeModal.title')}
        </h3>
        <p className="py-2 text-base-content/60 text-sm">
          {t('profile.password.changeModal.description')}
        </p>
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="form-control mb-3">
            <label className="label" htmlFor="current-password">
              <span className="label-text">
                {t('profile.password.changeModal.currentPassword')}
              </span>
            </label>
            <input
              id="current-password"
              type="password"
              className={`input input-bordered ${
                form.formState.errors.currentPassword ? 'input-error' : ''
              }`}
              placeholder={t(
                'profile.password.changeModal.currentPasswordPlaceholder',
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
          <div className="form-control mb-3">
            <label className="label" htmlFor="new-password-change">
              <span className="label-text">
                {t('profile.password.changeModal.newPassword')}
              </span>
            </label>
            <input
              id="new-password-change"
              type="password"
              className={`input input-bordered ${
                form.formState.errors.newPassword ? 'input-error' : ''
              }`}
              placeholder={t(
                'profile.password.changeModal.newPasswordPlaceholder',
              )}
              {...form.register('newPassword')}
            />
            {form.formState.errors.newPassword && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {form.formState.errors.newPassword.message}
                </span>
              </label>
            )}
          </div>
          <div className="form-control mb-4">
            <label className="label" htmlFor="confirm-password-change">
              <span className="label-text">
                {t('profile.password.changeModal.confirmPassword')}
              </span>
            </label>
            <input
              id="confirm-password-change"
              type="password"
              className={`input input-bordered ${
                form.formState.errors.confirmPassword ? 'input-error' : ''
              }`}
              placeholder={t(
                'profile.password.changeModal.confirmPasswordPlaceholder',
              )}
              {...form.register('confirmPassword')}
            />
            {form.formState.errors.confirmPassword && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {form.formState.errors.confirmPassword.message}
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
              {t('profile.password.changeModal.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  {t('profile.password.changeModal.submitting')}
                </>
              ) : (
                t('profile.password.changeModal.submit')
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
