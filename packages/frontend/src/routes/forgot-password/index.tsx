import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { CheckCircle, EnvelopeSimple } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import {
  AuthPageLayout,
  FooterLink,
  IconInput,
  PageHeader,
  SubmitButton,
} from '@/components/auth/index.js';
import { Alert } from '@/components/ui/index.js';
import { forgotPasswordMutationOptions } from '@/queries/password-reset.js';

export const Route = createFileRoute('/forgot-password/')({
  component: ForgotPassword,
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
      <AuthPageLayout>
        <Alert type="success" icon={CheckCircle} className="mb-4">
          {t('forgotPassword.success.title')}
        </Alert>

        <PageHeader
          title={t('forgotPassword.success.subtitle')}
          subtitle={t('forgotPassword.success.description', {
            email: submittedEmail,
          })}
        />

        <Alert type="info" icon={EnvelopeSimple} className="mb-4">
          {t('forgotPassword.success.checkSpam')}
        </Alert>

        <Link
          to="/login"
          className="btn btn-block h-10 font-semibold text-[14px]"
        >
          {t('forgotPassword.backToLogin')}
        </Link>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <PageHeader
        title={t('forgotPassword.title')}
        subtitle={t('forgotPassword.subtitle')}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <IconInput
          icon={EnvelopeSimple}
          type="email"
          placeholder={t('forgotPassword.email.placeholder')}
          autoComplete="email"
          error={errors.email}
          {...register('email')}
        />

        <SubmitButton
          isPending={forgotPasswordMutation.isPending}
          pendingText={t('forgotPassword.submitting')}
          className="mt-2"
        >
          {t('forgotPassword.submit')}
        </SubmitButton>
      </form>

      <FooterLink
        text={t('forgotPassword.footer.rememberedPassword')}
        linkText={t('register.link.login')}
        to="/login"
      />
    </AuthPageLayout>
  );
}
