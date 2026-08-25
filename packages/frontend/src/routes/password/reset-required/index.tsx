import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  LockIcon,
  LockKeyholeIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import { AuthOutcome } from '#frontend/components/auth/auth-outcome.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { PasswordStrength } from '#frontend/components/auth/password-strength.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { resetRequiredPasswordMutationOptions } from '#frontend/queries/password-reset.ts';

export const Route = createFileRoute('/password/reset-required/')({
  component: ResetRequiredPassword,
  errorComponent: RouteErrorFallback,
  beforeLoad: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(
      appConfigQueryOptions,
    );
    if (!config.auth.password.enabled || !config.auth.passkey.enabled) {
      throw redirect({ to: '/login' });
    }
  },
});

type FormValues = {
  password: string;
  confirmPassword: string;
};

function ResetRequiredPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  const policy = config.auth.password.policy;
  const schema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(
              policy.min_length,
              t('validation.password.min', { count: policy.min_length }),
            )
            .max(
              policy.max_length,
              t('validation.password.max', { count: policy.max_length }),
            ),
          confirmPassword: z
            .string()
            .min(1, t('validation.confirmPassword.required')),
        })
        .refine((value) => value.password === value.confirmPassword, {
          message: t('validation.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [policy.max_length, policy.min_length, t],
  );
  const mutation = useMutation({
    ...resetRequiredPasswordMutationOptions,
    onSuccess: () => setSuccess(true),
  });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { password: '', confirmPassword: '' },
    resolver: standardSchemaResolver(schema),
  });

  if (success) {
    return (
      <AuthLayout>
        <AuthOutcome
          description={t('resetRequiredPassword.success.description')}
          icon={CircleCheckIcon}
          title={t('resetRequiredPassword.success.title')}
          tone="success"
        >
          <TRButton
            className="w-full"
            intent="primary"
            onClick={() => navigate({ to: '/login' })}
            type="button"
            uiSize="lg"
          >
            {t('resetPassword.success.goToLogin')}
          </TRButton>
        </AuthOutcome>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('resetRequiredPassword.subtitle')}
        title={t('resetRequiredPassword.title')}
      />
      <form
        className="flex flex-col gap-tinyrack-lg"
        onSubmit={handleSubmit((values) =>
          mutation.mutate({ password: values.password }),
        )}
      >
        {mutation.isError && (
          <Alert icon={CircleAlertIcon} type="error">
            {t('resetRequiredPassword.error.expired')}
          </Alert>
        )}
        <div className="flex flex-col gap-tinyrack-sm">
          <AuthField
            autoComplete="new-password"
            error={errors.password}
            icon={LockIcon}
            label={t('resetPassword.password.label')}
            {...register('password')}
            type="password"
          />
          <PasswordStrength password={watch('password')} policy={policy} />
        </div>
        <AuthField
          autoComplete="new-password"
          error={errors.confirmPassword}
          icon={LockKeyholeIcon}
          label={t('resetPassword.confirmPassword.label')}
          {...register('confirmPassword')}
          type="password"
        />
        <TRButton
          className="w-full"
          intent="primary"
          loading={mutation.isPending}
          loadingLabel={t('resetPassword.submitting')}
          type="submit"
          uiSize="lg"
        >
          {t('resetPassword.submit')}
        </TRButton>
        {mutation.isError && (
          <TRButton
            className="w-full"
            intent="neutral"
            onClick={() => navigate({ to: '/login' })}
            type="button"
            uiSize="lg"
          >
            {t('resetPassword.success.goToLogin')}
          </TRButton>
        )}
      </form>
    </AuthLayout>
  );
}
