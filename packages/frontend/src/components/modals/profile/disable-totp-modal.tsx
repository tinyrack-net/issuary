import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { Modal, ModalActions } from '@/components/ui/modal';
import { queryKeys } from '@/queries/keys';
import { getSessionQueryOptions } from '@/queries/session.js';
import { disableTotpMutationOptions } from '@/queries/totp.js';

interface DisableTotpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DisableTotpModal({ isOpen, onClose }: DisableTotpModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .length(6, t('validation.totp.length'))
          .regex(/^\d{6}$/, t('validation.totp.digits')),
      }),
    [t],
  );

  const form = useForm({
    resolver: standardSchemaResolver(schema),
    defaultValues: { code: '' },
  });

  const mutation = useMutation({
    ...disableTotpMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.totp() });
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
      await mutation.mutateAsync({ code: data.code });
    } catch {
      form.setError('code', {
        message: t('profile.totp.disableModal.error'),
      });
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.totp.disableModal.title')}
      description={t('profile.totp.disableModal.description')}
    >
      <div className="alert alert-warning mt-2 mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 shrink-0 stroke-current"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>{t('profile.totp.disableModal.warning')}</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-control mb-4">
          <label className="label" htmlFor="disable-totp-code">
            <span className="label-text">
              {t('profile.totp.disableModal.codeLabel')}
            </span>
          </label>
          <input
            id="disable-totp-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            className={`input input-bordered text-center text-2xl tracking-widest ${
              form.formState.errors.code ? 'input-error' : ''
            }`}
            placeholder="000000"
            autoComplete="one-time-code"
            {...form.register('code')}
          />
          {form.formState.errors.code && (
            <span className="label-text-alt mt-1 text-error">
              {form.formState.errors.code.message}
            </span>
          )}
        </div>

        <ModalActions>
          <button
            type="button"
            className="btn"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            {t('profile.totp.disableModal.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-error"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                {t('profile.totp.disableModal.disabling')}
              </>
            ) : (
              t('profile.totp.disableModal.disable')
            )}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
