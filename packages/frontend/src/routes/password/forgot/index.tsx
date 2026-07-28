import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation } from '@tanstack/react-query';
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRText } from '@tinyrack/ui/components/text';
import { MailCheckIcon, MailIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthOutcome } from '#frontend/components/auth/auth-outcome.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
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
        email: z
          .string()
          .min(1, t('validation.email.required'))
          .pipe(z.email(t('validation.email.invalid'))),
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
      <AuthLayout>
        {/*
          The testid stays on a wrapper: e2e treats "the success alert" as the
          whole terminal state, which is now the outcome block rather than a
          banner stacked above a header.
        */}
        <div data-testid="alert-success">
          <AuthOutcome
            description={
              <>
                {t('forgotPassword.success.subtitle')}
                <br />
                {t('forgotPassword.success.description', {
                  email: submittedEmail,
                })}
              </>
            }
            icon={MailCheckIcon}
            title={t('forgotPassword.success.title')}
            tone="success"
          >
            <TRButton
              className="w-full"
              intent="primary"
              onClick={() => navigate({ to: '/login' })}
              type="button"
              uiSize="lg"
            >
              {t('forgotPassword.backToLogin')}
            </TRButton>
            <TRText align="center" color="muted" variant="caption">
              {t('forgotPassword.success.checkSpam')}
            </TRText>
          </AuthOutcome>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('forgotPassword.subtitle')}
        title={t('forgotPassword.title')}
      />

      <form
        className="flex flex-col gap-tinyrack-lg"
        onSubmit={handleSubmit(onSubmit)}
      >
        <AuthField
          autoComplete="email"
          error={errors.email}
          icon={MailIcon}
          label={t('forgotPassword.email.label')}
          placeholder={t('forgotPassword.email.placeholder')}
          {...register('email')}
          type="email"
        />

        <TRButton
          className="w-full"
          intent="primary"
          loading={forgotPasswordMutation.isPending}
          loadingLabel={t('forgotPassword.submitting')}
          type="submit"
          uiSize="lg"
        >
          {t('forgotPassword.submit')}
        </TRButton>
      </form>

      <AuthFooter>
        <AuthFooterLink
          link={<Link to="/login">{t('register.link.login')}</Link>}
          text={t('forgotPassword.footer.rememberedPassword')}
        />
      </AuthFooter>
    </AuthLayout>
  );
}
