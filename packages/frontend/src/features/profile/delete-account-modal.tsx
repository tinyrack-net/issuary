import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRForm } from '@tinyrack/ui/components/form';
import { TRText } from '@tinyrack/ui/components/text';
import { Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import z from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { tick } from '#frontend/libs/promise.ts';
import { deleteAccountMutationOptions } from '#frontend/queries/account.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  retentionDays: number;
}

export function DeleteAccountModal({
  isOpen,
  onClose,
  retentionDays,
}: DeleteAccountModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const schema = useMemo(
    () =>
      z.object({
        confirmation: z
          .string()
          .refine(
            (val) =>
              val.toLowerCase() ===
              t('profile.deleteAccount.modal.confirmPlaceholder').toLowerCase(),
            { message: t('validation.confirmText.mismatch') },
          ),
      }),
    [t],
  );

  const form = useForm({
    resolver: standardSchemaResolver(schema),
    defaultValues: { confirmation: '' },
  });

  const mutation = useMutation({
    ...deleteAccountMutationOptions,
    onSuccess: async () => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: null,
      });
      await tick();
      navigate('/login');
    },
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    form.reset();
    onClose();
  };

  const handleSubmit = form.handleSubmit(async () => {
    try {
      await mutation.mutateAsync();
    } catch {
      form.setError('root', {
        message: t('profile.deleteAccount.error'),
      });
    }
  });

  return (
    <Modal
      icon={Trash2Icon}
      isOpen={isOpen}
      onClose={handleClose}
      preventClose={mutation.isPending}
      title={t('profile.deleteAccount.modal.title')}
      variant="destructive"
    >
      <TRForm
        className="mt-tinyrack-lg flex flex-col gap-tinyrack-md"
        onSubmit={handleSubmit}
      >
        <AlertBanner variant="error">
          <TRText as="span" variant="bodySm">
            {t('profile.deleteAccount.modal.description', {
              days: retentionDays,
            })}
          </TRText>
          <br />
          <TRText
            as="span"
            className="opacity-tinyrack-hover"
            variant="caption"
          >
            {t('profile.deleteAccount.modal.warning')}
          </TRText>
        </AlertBanner>

        <AuthField
          autoComplete="off"
          error={form.formState.errors.confirmation}
          errorTestId="delete-account-error"
          id="delete-confirmation"
          label={t('profile.deleteAccount.modal.confirmLabel')}
          placeholder={t('profile.deleteAccount.modal.confirmPlaceholder')}
          {...form.register('confirmation')}
          type="text"
        />

        {form.formState.errors.root && (
          <AlertBanner variant="error">
            {form.formState.errors.root.message}
          </AlertBanner>
        )}

        <ModalActions>
          <TRButton
            appearance="outline"
            data-testid="delete-account-cancel"
            disabled={mutation.isPending}
            intent="neutral"
            onClick={handleClose}
            type="button"
            uiSize="sm"
          >
            {t('profile.deleteAccount.modal.cancel')}
          </TRButton>
          <TRButton
            data-testid="delete-account-submit"
            disabled={mutation.isPending}
            intent="danger"
            loading={mutation.isPending}
            loadingLabel={t('profile.deleteAccount.modal.confirming')}
            type="submit"
            uiSize="sm"
          >
            {mutation.isPending
              ? undefined
              : t('profile.deleteAccount.modal.confirm')}
          </TRButton>
        </ModalActions>
      </TRForm>
    </Modal>
  );
}
