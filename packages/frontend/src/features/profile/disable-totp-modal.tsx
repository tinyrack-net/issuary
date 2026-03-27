import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { ShieldCheckIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { TinyAuthError } from '#frontend/libs/error.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import { disableTotpMutationOptions } from '#frontend/queries/totp.ts';

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
      if (error instanceof TinyAuthError) {
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
      description={t('profile.totp.disableModal.description')}
      icon={ShieldCheckIcon}
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.totp.disableModal.title')}
      variant="destructive"
    >
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
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
            autoComplete="one-time-code"
            className={`input input-bordered input-sm w-full text-center text-xl tracking-widest ${
              form.formState.errors.code ? 'input-error' : ''
            }`}
            id="disable-totp-code"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]*"
            placeholder="000000"
            type="text"
            {...form.register('code')}
          />
          {form.formState.errors.code && (
            <span
              className="label-text-alt mt-0.5 text-error"
              data-testid="disable-totp-error"
            >
              {form.formState.errors.code.message}
            </span>
          )}
        </div>

        <ModalActions>
          <button
            className="btn btn-sm"
            data-testid="disable-totp-cancel"
            disabled={mutation.isPending}
            onClick={handleClose}
            type="button"
          >
            {t('profile.totp.disableModal.cancel')}
          </button>
          <button
            className="btn btn-sm btn-error"
            data-testid="disable-totp-submit"
            disabled={mutation.isPending}
            type="submit"
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
