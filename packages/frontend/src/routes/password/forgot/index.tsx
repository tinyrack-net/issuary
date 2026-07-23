import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { CheckCircleIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { FooterLink } from '#frontend/components/auth/footer-link.tsx';
import { IconInput } from '#frontend/components/auth/icon-input.tsx';
import { PageHeader } from '#frontend/components/auth/page-header.tsx';
import { SubmitButton } from '#frontend/components/auth/submit-button.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';

import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { forgotPasswordMutationOptions } from '#frontend/queries/password-reset.ts';

export const Route = createFileRoute('/password/forgot/')({
  component: ForgotPassword,
  errorComponent: RouteErrorFallback,
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
  const navigate = useNavigate();
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const forgotPasswordSchema = useMemo(
    () =>
      z.object({
        email: z.email({ error: t('validation.email.invalid') }),
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
        <Alert className="mb-4" icon={CheckCircleIcon} type="success">
          {t('forgotPassword.success.title')}
        </Alert>

        <PageHeader
          subtitle={t('forgotPassword.success.description', {
            email: submittedEmail,
          })}
          title={t('forgotPassword.success.subtitle')}
        />

        <Alert className="mb-4" icon={EnvelopeSimpleIcon} type="info">
          {t('forgotPassword.success.checkSpam')}
        </Alert>

        <TRButton
          className="w-full font-semibold text-[14px]"
          intent="primary"
          onClick={() => navigate({ to: '/login' })}
        >
          {t('forgotPassword.backToLogin')}
        </TRButton>
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
          label={t('forgotPassword.email.label')}
          placeholder={t('forgotPassword.email.placeholder')}
          {...register('email')}
          type="email"
        />

        <SubmitButton
          className="mt-2"
          isPending={forgotPasswordMutation.isPending}
          pendingText={t('forgotPassword.submitting')}
        >
          {t('forgotPassword.submit')}
        </SubmitButton>
      </form>

      <FooterLink
        as={Link}
        linkText={t('register.link.login')}
        text={t('forgotPassword.footer.rememberedPassword')}
        to="/login"
      />
    </PageLayout>
  );
}
