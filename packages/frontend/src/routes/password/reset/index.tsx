import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  CheckCircleIcon,
  KeyIcon,
  LockIcon,
  LockKeyIcon,
} from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { IconInput } from '@/components/auth/icon-input.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { Alert } from '@/components/ui/alert.js';
import { PageLayout } from '@/components/ui/page-layout.js';
import { appConfigQueryOptions } from '@/queries/config.js';
import { resetPasswordMutationOptions } from '@/queries/password-reset.js';

const SearchSchema = z.object({
  token: z.string().default(''),
});

export const Route = createFileRoute('/password/reset/')({
  component: ResetPassword,
  validateSearch: SearchSchema,
  beforeLoad: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(
      appConfigQueryOptions,
    );
    const isPasswordAuthEnabled = config.auth.password.enabled;
    if (!isPasswordAuthEnabled) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(appConfigQueryOptions);
  },
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
      <PageLayout cardPadding maxWidth="100">
        <Alert
          className="mb-4"
          data-testid="password-reset-success-alert"
          icon={CheckCircleIcon}
          type="success"
        >
          {t('resetPassword.success.title')}
        </Alert>

        <PageHeader
          subtitle={t('resetPassword.success.description')}
          title={t('resetPassword.success.subtitle')}
        />

        <button
          className="btn btn-block h-10 font-semibold text-[14px]"
          data-testid="password-reset-login-btn"
          onClick={() => navigate({ to: '/login' })}
          type="button"
        >
          {t('resetPassword.success.goToLogin')}
        </button>
      </PageLayout>
    );
  }

  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('resetPassword.subtitle')}
        title={t('resetPassword.title')}
      />

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        {!queryToken && (
          <IconInput
            error={errors.token}
            icon={KeyIcon}
            placeholder={t('resetPassword.token.placeholder')}
            {...register('token')}
            data-testid="password-reset-token-input"
            type="text"
          />
        )}

        {queryToken && errors.token && (
          <div
            className="alert alert-error"
            data-testid="password-reset-token-error-alert"
          >
            <span className="text-sm">{errors.token.message}</span>
          </div>
        )}

        <IconInput
          autoComplete="new-password"
          error={errors.password}
          icon={LockIcon}
          placeholder={t('resetPassword.password.placeholder')}
          {...register('password')}
          data-testid="password-reset-password-input"
          type="password"
        />

        <IconInput
          autoComplete="new-password"
          error={errors.confirmPassword}
          icon={LockKeyIcon}
          placeholder={t('resetPassword.confirmPassword.placeholder')}
          {...register('confirmPassword')}
          data-testid="password-reset-confirm-input"
          type="password"
        />

        <SubmitButton
          className="mt-2"
          data-testid="password-reset-submit-btn"
          isPending={resetPasswordMutation.isPending}
          pendingText={t('resetPassword.submitting')}
        >
          {t('resetPassword.submit')}
        </SubmitButton>
      </form>

      <div className="mt-6 text-center text-base-content/70 text-xs">
        <Link
          className="link link-info font-medium"
          data-testid="password-reset-login-link"
          to="/login"
        >
          {t('resetPassword.backToLogin')}
        </Link>
      </div>
    </PageLayout>
  );
}
