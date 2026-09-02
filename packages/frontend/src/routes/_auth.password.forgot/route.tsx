import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation } from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRForm } from '@tinyrack/ui/components/form';
import { TRText } from '@tinyrack/ui/components/text';
import { MailCheckIcon, MailIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, redirect, useNavigate } from 'react-router';
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
import {
  createRouteLoaderData,
  NativeRouteErrorBoundary,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import { forgotPasswordMutationOptions } from '#frontend/queries/password-reset.ts';

import type { Route } from './+types/route.js';

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
              onClick={() => navigate('/login')}
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

      <TRForm
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
      </TRForm>

      <AuthFooter>
        <AuthFooterLink
          link={<Link to="/login">{t('register.link.login')}</Link>}
          text={t('forgotPassword.footer.rememberedPassword')}
        />
      </AuthFooter>
    </AuthLayout>
  );
}

export function loader({ context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  if (!runtime.config.auth.password.enabled) throw redirect('/login');
  return createRouteLoaderData(runtime.queryClient, {});
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <NativeRouteErrorBoundary component={RouteErrorFallback} error={error} />
  );
}

export default function ForgotPasswordRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <ForgotPassword />
    </RouteHydrationBoundary>
  );
}
