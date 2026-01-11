import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { setPasswordMutationOptions } from '@/queries/password.js';
import { getSessionQueryOptions } from '@/queries/session.js';

interface SetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SetPasswordModal({ isOpen, onClose }: SetPasswordModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const schema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(6, t('validation.password.min'))
            .max(100, t('validation.password.max')),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('validation.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  );

  const form = useForm({
    resolver: standardSchemaResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    ...setPasswordMutationOptions,
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
      await mutation.mutateAsync({ password: data.password });
    } catch {
      form.setError('root', {
        message: t('profile.password.setModal.error'),
      });
    }
  });

  if (!isOpen) {
    return null;
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">
          {t('profile.password.setModal.title')}
        </h3>
        <p className="py-2 text-base-content/60 text-sm">
          {t('profile.password.setModal.description')}
        </p>
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="form-control mb-3">
            <label className="label" htmlFor="new-password">
              <span className="label-text">
                {t('profile.password.setModal.newPassword')}
              </span>
            </label>
            <input
              id="new-password"
              type="password"
              className={`input input-bordered ${
                form.formState.errors.password ? 'input-error' : ''
              }`}
              placeholder={t(
                'profile.password.setModal.newPasswordPlaceholder',
              )}
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {form.formState.errors.password.message}
                </span>
              </label>
            )}
          </div>
          <div className="form-control mb-4">
            <label className="label" htmlFor="confirm-password">
              <span className="label-text">
                {t('profile.password.setModal.confirmPassword')}
              </span>
            </label>
            <input
              id="confirm-password"
              type="password"
              className={`input input-bordered ${
                form.formState.errors.confirmPassword ? 'input-error' : ''
              }`}
              placeholder={t(
                'profile.password.setModal.confirmPasswordPlaceholder',
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
              {t('profile.password.setModal.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  {t('profile.password.setModal.submitting')}
                </>
              ) : (
                t('profile.password.setModal.submit')
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
