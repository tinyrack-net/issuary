import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { KeyIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { AlertBanner } from '@/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@/components/ui/modal.js';
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.password.setModal.title')}
      description={t('profile.password.setModal.description')}
      icon={KeyIcon}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="form-control">
          <label className="label w-full" htmlFor="new-password">
            <span className="label-text text-xs">
              {t('profile.password.setModal.newPassword')}
            </span>
          </label>
          <input
            id="new-password"
            type="password"
            className={`input input-bordered input-sm w-full ${
              form.formState.errors.password ? 'input-error' : ''
            }`}
            placeholder={t('profile.password.setModal.newPasswordPlaceholder')}
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
            id="confirm-password"
            type="password"
            className={`input input-bordered input-sm w-full ${
              form.formState.errors.confirmPassword ? 'input-error' : ''
            }`}
            placeholder={t(
              'profile.password.setModal.confirmPasswordPlaceholder',
            )}
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
            type="button"
            className="btn btn-sm"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            {t('profile.password.setModal.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-sm btn-primary"
            disabled={mutation.isPending}
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
