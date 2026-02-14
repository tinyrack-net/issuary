import { AlertBanner } from '@frontend/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@frontend/components/ui/modal.js';
import { setPasswordMutationOptions } from '@frontend/queries/password.js';
import { getSessionQueryOptions } from '@frontend/queries/session.js';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { KeyIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';

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

  return (
    <Modal
      description={t('profile.password.setModal.description')}
      icon={KeyIcon}
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.password.setModal.title')}
    >
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="form-control">
          <label className="label w-full" htmlFor="new-password">
            <span className="label-text text-xs">
              {t('profile.password.setModal.newPassword')}
            </span>
          </label>
          <input
            className={`input input-bordered input-sm w-full ${
              form.formState.errors.password ? 'input-error' : ''
            }`}
            data-testid="modal-set-password-password-input"
            id="new-password"
            placeholder={t('profile.password.setModal.newPasswordPlaceholder')}
            type="password"
            {...form.register('password')}
          />
          {form.formState.errors.password && (
            <span className="label-text-alt mt-0.5 text-error">
              {form.formState.errors.password.message}
            </span>
          )}
        </div>
        <div className="form-control">
          <label className="label w-full" htmlFor="confirm-password">
            <span className="label-text text-xs">
              {t('profile.password.setModal.confirmPassword')}
            </span>
          </label>
          <input
            className={`input input-bordered input-sm w-full ${
              form.formState.errors.confirmPassword ? 'input-error' : ''
            }`}
            data-testid="modal-set-password-confirm-input"
            id="confirm-password"
            placeholder={t(
              'profile.password.setModal.confirmPasswordPlaceholder',
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
            data-testid="modal-set-password-cancel-btn"
            disabled={mutation.isPending}
            onClick={handleClose}
            type="button"
          >
            {t('profile.password.setModal.cancel')}
          </button>
          <button
            className="btn btn-sm btn-primary"
            data-testid="modal-set-password-submit-btn"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                {t('profile.password.setModal.submitting')}
              </>
            ) : (
              t('profile.password.setModal.submit')
            )}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
