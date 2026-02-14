import { FooterLink } from '@frontend/components/auth/footer-link.js';
import { IconInput } from '@frontend/components/auth/icon-input.js';
import { PageHeader } from '@frontend/components/auth/page-header.js';
import { SubmitButton } from '@frontend/components/auth/submit-button.js';
import { Alert } from '@frontend/components/ui/alert.js';
import { PageLayout } from '@frontend/components/ui/page-layout.js';
import { appConfigQueryOptions } from '@frontend/queries/config.js';
import { forgotPasswordMutationOptions } from '@frontend/queries/password-reset.js';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { CheckCircleIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

export const Route = createFileRoute('/password/forgot/')({
  component: ForgotPassword,
  beforeLoad: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(
      appConfigQueryOptions,
    );
    const isPasswordAuthEnabled = config?.auth.password.enabled;
    if (!isPasswordAuthEnabled) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(appConfigQueryOptions);
  },
});

type ForgotPasswordFormValues = {
  email: string;
};

function ForgotPassword() {
  const { t } = useTranslation();
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const forgotPasswordSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('validation.email.invalid')),
      }),
    [t],
  );

  const forgotPasswordMutation = useMutation({
    ...forgotPasswordMutationOptions,
    onSuccess: () => {
      setEmailSent(true);
    },
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    defaultValues: {
      email: '',
    },
    resolver: standardSchemaResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      setSubmittedEmail(values.email);
      await forgotPasswordMutation.mutateAsync(values);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'USER_NOT_EDITABLE'
      ) {
        setError('email', {
          type: 'manual',
          message: t('forgotPassword.error.notEditable'),
        });
      } else {
        setEmailSent(true);
      }
    }
  };

  if (emailSent) {
    return (
      <PageLayout cardPadding maxWidth="100">
        <Alert
          className="mb-4"
          data-testid="password-forgot-success-alert"
          icon={CheckCircleIcon}
          type="success"
        >
          {t('forgotPassword.success.title')}
        </Alert>

        <PageHeader
          subtitle={t('forgotPassword.success.description', {
            email: submittedEmail,
          })}
          title={t('forgotPassword.success.subtitle')}
        />

        <Alert
          className="mb-4"
          data-testid="password-forgot-spam-alert"
          icon={EnvelopeSimpleIcon}
          type="info"
        >
          {t('forgotPassword.success.checkSpam')}
        </Alert>

        <Link
          className="btn btn-block h-10 font-semibold text-[14px]"
          data-testid="password-forgot-login-btn"
          to="/login"
        >
          {t('forgotPassword.backToLogin')}
        </Link>
      </PageLayout>
    );
  }

  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('forgotPassword.subtitle')}
        title={t('forgotPassword.title')}
      />

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <IconInput
          autoComplete="email"
          error={errors.email}
          icon={EnvelopeSimpleIcon}
          placeholder={t('forgotPassword.email.placeholder')}
          {...register('email')}
          data-testid="password-forgot-email-input"
          type="email"
        />

        <SubmitButton
          className="mt-2"
          data-testid="password-forgot-submit-btn"
          isPending={forgotPasswordMutation.isPending}
          pendingText={t('forgotPassword.submitting')}
        >
          {t('forgotPassword.submit')}
        </SubmitButton>
      </form>

      <FooterLink
        data-testid="password-forgot-login-link"
        linkText={t('register.link.login')}
        text={t('forgotPassword.footer.rememberedPassword')}
        to="/login"
      />
    </PageLayout>
  );
}
