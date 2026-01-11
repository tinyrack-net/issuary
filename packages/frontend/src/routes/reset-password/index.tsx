import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { CheckCircle, Key, Lock, LockKey } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import {
  AuthPageLayout,
  IconInput,
  PageHeader,
  SubmitButton,
} from '@/components/auth/index.js';
import { Alert } from '@/components/ui/index.js';
import { resetPasswordMutationOptions } from '@/queries/password-reset.js';

const SearchSchema = z.object({
  token: z.string().default(''),
});

export const Route = createFileRoute('/reset-password/')({
  component: ResetPassword,
  validateSearch: SearchSchema,
});

type ResetPasswordFormValues = {
  token: string;
  password: string;
  confirmPassword: string;
};

function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { token: queryToken } = search;
  const [resetSuccess, setResetSuccess] = useState(false);

  const resetPasswordSchema = useMemo(
    () =>
      z
        .object({
          token: z.string().min(1, t('validation.token.required')),
          password: z
            .string()
            .min(6, t('validation.password.min'))
            .max(100, t('validation.password.max')),
          confirmPassword: z
            .string()
            .min(1, t('validation.confirmPassword.required')),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('validation.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  );

  const resetPasswordMutation = useMutation({
    ...resetPasswordMutationOptions,
    onSuccess: () => {
      setResetSuccess(true);
    },
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    defaultValues: {
      token: queryToken || '',
      password: '',
      confirmPassword: '',
    },
    resolver: standardSchemaResolver(resetPasswordSchema),
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    try {
      await resetPasswordMutation.mutateAsync({
        token: values.token,
        password: values.password,
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'INVALID_PASSWORD_RESET_TOKEN') {
          setError('token', {
            type: 'manual',
            message: t('resetPassword.error.invalidToken'),
          });
        } else if (error.code === 'USER_NOT_EDITABLE') {
          setError('token', {
            type: 'manual',
            message: t('resetPassword.error.notEditable'),
          });
        }
      } else {
        setError('token', {
          type: 'manual',
          message: t('resetPassword.error.invalidToken'),
        });
      }
    }
  };

  if (resetSuccess) {
    return (
      <AuthPageLayout>
        <Alert type="success" icon={CheckCircle} className="mb-4">
          {t('resetPassword.success.title')}
        </Alert>

        <PageHeader
          title={t('resetPassword.success.subtitle')}
          subtitle={t('resetPassword.success.description')}
        />

        <button
          type="button"
          onClick={() => navigate({ to: '/login' })}
          className="btn btn-block h-10 font-semibold text-[14px]"
        >
          {t('resetPassword.success.goToLogin')}
        </button>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <PageHeader
        title={t('resetPassword.title')}
        subtitle={t('resetPassword.subtitle')}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {!queryToken && (
          <IconInput
            icon={Key}
            type="text"
            placeholder={t('resetPassword.token.placeholder')}
            error={errors.token}
            {...register('token')}
          />
        )}

        {queryToken && errors.token && (
          <div className="alert alert-error">
            <span className="text-sm">{errors.token.message}</span>
          </div>
        )}

        <IconInput
          icon={Lock}
          type="password"
          placeholder={t('resetPassword.password.placeholder')}
          autoComplete="new-password"
          error={errors.password}
          {...register('password')}
        />

        <IconInput
          icon={LockKey}
          type="password"
          placeholder={t('resetPassword.confirmPassword.placeholder')}
          autoComplete="new-password"
          error={errors.confirmPassword}
          {...register('confirmPassword')}
        />

        <SubmitButton
          isPending={resetPasswordMutation.isPending}
          pendingText={t('resetPassword.submitting')}
          className="mt-2"
        >
          {t('resetPassword.submit')}
        </SubmitButton>
      </form>

      <div className="mt-6 text-center text-base-content/70 text-xs">
        <Link to="/login" className="link link-info font-medium">
          {t('resetPassword.backToLogin')}
        </Link>
      </div>
    </AuthPageLayout>
  );
}
