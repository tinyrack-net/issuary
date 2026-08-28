import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRForm } from '@tinyrack/ui/components/form';
import { KeyRoundIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { IssuaryError } from '#frontend/libs/error.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { changePasswordMutationOptions } from '#frontend/queries/password.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';

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
  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);
  const passwordPolicy = configData.auth.password.policy;

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t('validation.password.required')),
          newPassword: z
            .string()
            .min(
              passwordPolicy.min_length,
              t('validation.password.min', {
                count: passwordPolicy.min_length,
              }),
            )
            .max(
              passwordPolicy.max_length,
              t('validation.password.max', {
                count: passwordPolicy.max_length,
              }),
            ),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t('validation.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [passwordPolicy.max_length, passwordPolicy.min_length, t],
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
      if (
        err instanceof IssuaryError &&
        err.code === 'INVALID_CURRENT_PASSWORD'
      ) {
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

  return (
    <Modal
      description={t('profile.password.changeModal.description')}
      icon={KeyRoundIcon}
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.password.changeModal.title')}
    >
      <TRForm
        className="mt-tinyrack-lg flex flex-col gap-tinyrack-md"
        onSubmit={handleSubmit}
      >
        <AuthField
          error={form.formState.errors.currentPassword}
          errorTestId="change-password-error-currentPassword"
          id="current-password"
          label={t('profile.password.changeModal.currentPassword')}
          placeholder={t(
            'profile.password.changeModal.currentPasswordPlaceholder',
          )}
          {...form.register('currentPassword')}
          type="password"
        />
        <AuthField
          error={form.formState.errors.newPassword}
          errorTestId="change-password-error-newPassword"
          id="new-password-change"
          label={t('profile.password.changeModal.newPassword')}
          placeholder={t('profile.password.changeModal.newPasswordPlaceholder')}
          {...form.register('newPassword')}
          type="password"
        />
        <AuthField
          error={form.formState.errors.confirmPassword}
          errorTestId="change-password-error-confirmPassword"
          id="confirm-password-change"
          label={t('profile.password.changeModal.confirmPassword')}
          placeholder={t(
            'profile.password.changeModal.confirmPasswordPlaceholder',
          )}
          {...form.register('confirmPassword')}
          type="password"
        />
        {form.formState.errors.root && (
          <AlertBanner variant="error">
            {form.formState.errors.root.message}
          </AlertBanner>
        )}
        <ModalActions>
          <TRButton
            appearance="outline"
            data-testid="change-password-cancel"
            disabled={mutation.isPending}
            intent="neutral"
            onClick={handleClose}
            type="button"
            uiSize="sm"
          >
            {t('profile.password.changeModal.cancel')}
          </TRButton>
          <TRButton
            data-testid="change-password-submit"
            disabled={mutation.isPending}
            intent="primary"
            loading={mutation.isPending}
            loadingLabel={t('profile.password.changeModal.submitting')}
            type="submit"
            uiSize="sm"
          >
            {mutation.isPending
              ? undefined
              : t('profile.password.changeModal.submit')}
          </TRButton>
        </ModalActions>
      </TRForm>
    </Modal>
  );
}
