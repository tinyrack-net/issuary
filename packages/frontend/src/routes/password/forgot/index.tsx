import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { CheckCircleIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { FooterLink } from '@/components/auth/footer-link.js';
import { IconInput } from '@/components/auth/icon-input.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { Alert } from '@/components/ui/alert.js';
import { PageLayout } from '@/components/ui/page-layout.js';
import { appConfigQueryOptions } from '@/queries/config.js';
import { forgotPasswordMutationOptions } from '@/queries/password-reset.js';

export const Route = createFileRoute('/password/forgot/')({
  component: ForgotPassword,
  beforeLoad: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(
      appConfigQueryOptions,
    );
    const isPasswordAuthEnabled =
      config?.basic_authentication_methods.password.enabled;
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
      <PageLayout maxWidth="100" cardPadding>
        <Alert
          type="success"
          icon={CheckCircleIcon}
          className="mb-4"
          data-testid="password-forgot-success-alert"
        >
          {t('forgotPassword.success.title')}
        </Alert>

        <PageHeader
          title={t('forgotPassword.success.subtitle')}
          subtitle={t('forgotPassword.success.description', {
            email: submittedEmail,
          })}
        />

        <Alert
          type="info"
          icon={EnvelopeSimpleIcon}
          className="mb-4"
          data-testid="password-forgot-spam-alert"
        >
          {t('forgotPassword.success.checkSpam')}
        </Alert>

        <Link
          to="/login"
          className="btn btn-block h-10 font-semibold text-[14px]"
          data-testid="password-forgot-login-btn"
        >
          {t('forgotPassword.backToLogin')}
        </Link>
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="100" cardPadding>
      <PageHeader
        title={t('forgotPassword.title')}
        subtitle={t('forgotPassword.subtitle')}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <IconInput
          icon={EnvelopeSimpleIcon}
          placeholder={t('forgotPassword.email.placeholder')}
          autoComplete="email"
          error={errors.email}
          {...register('email')}
          type="email"
          data-testid="password-forgot-email-input"
        />

        <SubmitButton
          isPending={forgotPasswordMutation.isPending}
          pendingText={t('forgotPassword.submitting')}
          className="mt-2"
          data-testid="password-forgot-submit-btn"
        >
          {t('forgotPassword.submit')}
        </SubmitButton>
      </form>

      <FooterLink
        text={t('forgotPassword.footer.rememberedPassword')}
        linkText={t('register.link.login')}
        to="/login"
        data-testid="password-forgot-login-link"
      />
    </PageLayout>
  );
}
