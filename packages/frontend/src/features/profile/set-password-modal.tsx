import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { KeyRoundIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { setPasswordMutationOptions } from '#frontend/queries/password.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';

interface SetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SetPasswordModal({ isOpen, onClose }: SetPasswordModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);
  const passwordPolicy = configData.auth.password.policy;

  const schema = useMemo(
    () =>
      z
        .object({
          password: z
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
        .refine((data) => data.password === data.confirmPassword, {
          message: t('validation.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [passwordPolicy.max_length, passwordPolicy.min_length, t],
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
    } catch (error) {
      void error;
      form.setError('root', {
        message: t('profile.password.setModal.error'),
      });
    }
  });

  return (
    <Modal
      description={t('profile.password.setModal.description')}
      icon={KeyRoundIcon}
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.password.setModal.title')}
    >
      <form
        className="mt-tinyrack-lg flex flex-col gap-tinyrack-md"
        onSubmit={handleSubmit}
      >
        <AuthField
          error={form.formState.errors.password}
          errorTestId="set-password-error-password"
          id="new-password"
          label={t('profile.password.setModal.newPassword')}
          placeholder={t('profile.password.setModal.newPasswordPlaceholder')}
          {...form.register('password')}
          type="password"
        />
        <AuthField
          error={form.formState.errors.confirmPassword}
          errorTestId="set-password-error-confirmPassword"
          id="confirm-password"
          label={t('profile.password.setModal.confirmPassword')}
          placeholder={t(
            'profile.password.setModal.confirmPasswordPlaceholder',
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
            data-testid="set-password-cancel"
            disabled={mutation.isPending}
            intent="neutral"
            onClick={handleClose}
            type="button"
            uiSize="sm"
          >
            {t('profile.password.setModal.cancel')}
          </TRButton>
          <TRButton
            data-testid="set-password-submit"
            disabled={mutation.isPending}
            intent="primary"
            loading={mutation.isPending}
            loadingLabel={t('profile.password.setModal.submitting')}
            type="submit"
            uiSize="sm"
          >
            {mutation.isPending
              ? undefined
              : t('profile.password.setModal.submit')}
          </TRButton>
        </ModalActions>
      </form>
    </Modal>
  );
}
