import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { ShieldCheckIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { IssuaryError } from '#frontend/libs/error.ts';
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
      if (error instanceof IssuaryError) {
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
      <form
        className="mt-tinyrack-lg flex flex-col gap-tinyrack-md"
        onSubmit={handleSubmit}
      >
        <AlertBanner variant="warning">
          {t('profile.totp.disableModal.warning')}
        </AlertBanner>

        <AuthField
          autoComplete="one-time-code"
          error={form.formState.errors.code}
          errorTestId="disable-totp-error"
          id="disable-totp-code"
          inputMode="numeric"
          label={t('profile.totp.disableModal.codeLabel')}
          maxLength={6}
          pattern="[0-9]*"
          placeholder="000000"
          {...form.register('code')}
          type="text"
        />

        <ModalActions>
          <TRButton
            appearance="outline"
            data-testid="disable-totp-cancel"
            disabled={mutation.isPending}
            intent="neutral"
            onClick={handleClose}
            type="button"
            uiSize="sm"
          >
            {t('profile.totp.disableModal.cancel')}
          </TRButton>
          <TRButton
            data-testid="disable-totp-submit"
            disabled={mutation.isPending}
            intent="danger"
            loading={mutation.isPending}
            loadingLabel={t('profile.totp.disableModal.disabling')}
            type="submit"
            uiSize="sm"
          >
            {mutation.isPending
              ? undefined
              : t('profile.totp.disableModal.disable')}
          </TRButton>
        </ModalActions>
      </form>
    </Modal>
  );
}
