import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import { KeyRoundIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { TinyAuthError } from '#frontend/libs/error.ts';
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
        err instanceof TinyAuthError &&
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
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <TRField.Root>
          <TRField.Label htmlFor="current-password">
            {t('profile.password.changeModal.currentPassword')}
          </TRField.Label>
          <TRInput
            id="current-password"
            placeholder={t(
              'profile.password.changeModal.currentPasswordPlaceholder',
            )}
            type="password"
            uiSize="sm"
            {...form.register('currentPassword')}
          />
          {form.formState.errors.currentPassword && (
            <div
              className="tr-field-error"
              data-testid="change-password-error-currentPassword"
            >
              {form.formState.errors.currentPassword.message}
            </div>
          )}
        </TRField.Root>
        <TRField.Root>
          <TRField.Label htmlFor="new-password-change">
            {t('profile.password.changeModal.newPassword')}
          </TRField.Label>
          <TRInput
            id="new-password-change"
            placeholder={t(
              'profile.password.changeModal.newPasswordPlaceholder',
            )}
            type="password"
            uiSize="sm"
            {...form.register('newPassword')}
          />
          {form.formState.errors.newPassword && (
            <div
              className="tr-field-error"
              data-testid="change-password-error-newPassword"
            >
              {form.formState.errors.newPassword.message}
            </div>
          )}
        </TRField.Root>
        <TRField.Root>
          <TRField.Label htmlFor="confirm-password-change">
            {t('profile.password.changeModal.confirmPassword')}
          </TRField.Label>
          <TRInput
            id="confirm-password-change"
            placeholder={t(
              'profile.password.changeModal.confirmPasswordPlaceholder',
            )}
            type="password"
            uiSize="sm"
            {...form.register('confirmPassword')}
          />
          {form.formState.errors.confirmPassword && (
            <div
              className="tr-field-error"
              data-testid="change-password-error-confirmPassword"
            >
              {form.formState.errors.confirmPassword.message}
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
      </form>
    </Modal>
  );
}
