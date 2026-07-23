import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { KeyIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { TinyAuthError } from '#frontend/libs/error.ts';
import { removePasswordMutationOptions } from '#frontend/queries/password.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';

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
      if (err instanceof TinyAuthError) {
        if (err.code === 'INVALID_CURRENT_PASSWORD') {
          form.setError('currentPassword', {
            message: t('profile.password.removeModal.invalidCurrent'),
          });
          return;
        }
        if (err.code === 'CANNOT_REMOVE_LAST_AUTH_METHOD') {
          form.setError('root', {
            message: t('profile.password.removeModal.noOAuth'),
          });
          return;
        }
        if (err.code === 'CANNOT_REMOVE_PASSWORD_WITH_SECOND_FACTOR_ONLY') {
          form.setError('root', {
            message: t('profile.password.removeModal.noOAuthWith2FA'),
          });
          return;
        }
      }
      form.setError('root', {
        message: t('profile.password.removeModal.error'),
      });
    }
  });

  return (
    <Modal
      description={t('profile.password.removeModal.description')}
      icon={KeyIcon}
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.password.removeModal.title')}
      variant="destructive"
    >
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <TRField.Root uiSize="sm">
          <TRField.Label htmlFor="current-password-remove">
            {t('profile.password.removeModal.currentPassword')}
          </TRField.Label>
          <TRInput
            id="current-password-remove"
            placeholder={t(
              'profile.password.removeModal.currentPasswordPlaceholder',
            )}
            type="password"
            uiSize="sm"
            {...form.register('currentPassword')}
          />
          {form.formState.errors.currentPassword && (
            <div className="tr-field-error" data-testid="remove-password-error">
              {form.formState.errors.currentPassword.message}
            </div>
          )}
        </TRField.Root>
        {form.formState.errors.root && (
          <AlertBanner variant="error">
            {form.formState.errors.root.message}
          </AlertBanner>
        )}
        <ModalActions>
          <TRButton
            data-testid="remove-password-cancel"
            disabled={mutation.isPending}
            onClick={handleClose}
            type="button"
            uiSize="sm"
          >
            {t('profile.password.removeModal.cancel')}
          </TRButton>
          <TRButton
            data-testid="remove-password-submit"
            disabled={mutation.isPending}
            intent="danger"
            loading={mutation.isPending}
            loadingLabel={t('profile.password.removeModal.submitting')}
            type="submit"
            uiSize="sm"
          >
            {mutation.isPending
              ? undefined
              : t('profile.password.removeModal.submit')}
          </TRButton>
        </ModalActions>
      </form>
    </Modal>
  );
}
