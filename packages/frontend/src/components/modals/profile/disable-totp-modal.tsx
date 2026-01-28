import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { ShieldCheckIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { AlertBanner } from '@/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@/components/ui/modal.js';
import { ApiError } from '@/libs/error.js';
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
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'CANNOT_REMOVE_LAST_SECOND_FACTOR') {
          form.setError('code', {
            message: t(
              'profile.totp.disableModal.cannotRemoveLastSecondFactor',
            ),
          });
          return;
        }
      }
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
      icon={ShieldCheckIcon}
      variant="destructive"
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <AlertBanner variant="warning">
          {t('profile.totp.disableModal.warning')}
        </AlertBanner>

        <div className="form-control">
          <label className="label w-full" htmlFor="disable-totp-code">
            <span className="label-text text-xs">
              {t('profile.totp.disableModal.codeLabel')}
            </span>
          </label>
          <input
            id="disable-totp-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            className={`input input-bordered input-sm w-full text-center text-xl tracking-widest ${
              form.formState.errors.code ? 'input-error' : ''
            }`}
            placeholder="000000"
            autoComplete="one-time-code"
            {...form.register('code')}
          />
          {form.formState.errors.code && (
            <span className="label-text-alt mt-0.5 text-error">
              {form.formState.errors.code.message}
            </span>
          )}
        </div>

        <ModalActions>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            {t('profile.totp.disableModal.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-sm btn-error"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-xs" />
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
