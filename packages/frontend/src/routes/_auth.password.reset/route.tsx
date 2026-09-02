import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRForm } from '@tinyrack/ui/components/form';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  KeyRoundIcon,
  LockIcon,
  LockKeyholeIcon,
} from 'lucide-react';
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
import { PasswordStrength } from '#frontend/components/auth/password-strength.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import {
  createRouteLoaderData,
  NativeRouteErrorBoundary,
  parseRequestSearch,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';

import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { resetPasswordMutationOptions } from '#frontend/queries/password-reset.ts';

const SearchSchema = z.object({
  token: z.string().default(''),
});

import type { Route } from './+types/route.js';

type ResetPasswordFormValues = {
  token: string;
  password: string;
  confirmPassword: string;
};

function ResetPassword({ search }: { search: z.infer<typeof SearchSchema> }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token: queryToken } = search;
  const [resetSuccess, setResetSuccess] = useState(false);
  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);
  const passwordPolicy = configData.auth.password.policy;

  const resetPasswordSchema = useMemo(
    () =>
      z
        .object({
          token: z.string().min(1, t('validation.token.required')),
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
          confirmPassword: z
            .string()
            .min(1, t('validation.confirmPassword.required')),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('validation.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [passwordPolicy.max_length, passwordPolicy.min_length, t],
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
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    defaultValues: {
      token: queryToken || '',
      password: '',
      confirmPassword: '',
    },
    resolver: standardSchemaResolver(resetPasswordSchema),
  });

  const passwordValue = watch('password');

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
                {t('resetPassword.success.subtitle')}
                <br />
                {t('resetPassword.success.description')}
              </>
            }
            icon={CircleCheckIcon}
            title={t('resetPassword.success.title')}
            tone="success"
          >
            <TRButton
              className="w-full"
              data-testid="reset-password-go-login"
              intent="primary"
              onClick={() => navigate('/login')}
              type="button"
              uiSize="lg"
            >
              {t('resetPassword.success.goToLogin')}
            </TRButton>
          </AuthOutcome>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('resetPassword.subtitle')}
        title={t('resetPassword.title')}
      />

      <TRForm
        className="flex flex-col gap-tinyrack-lg"
        onSubmit={handleSubmit(onSubmit)}
      >
        {!queryToken && (
          <AuthField
            error={errors.token}
            icon={KeyRoundIcon}
            label={t('resetPassword.token.label')}
            placeholder={t('resetPassword.token.placeholder')}
            {...register('token')}
            type="text"
          />
        )}

        {/*
          A token that arrived in the URL has no field to attach an error to,
          so a rejected link is reported as a banner above the form. The form
          stays put: the user can paste a fresh token without a round trip.
        */}
        {queryToken && errors.token && (
          <Alert
            data-testid="reset-password-token-error"
            icon={CircleAlertIcon}
            type="error"
          >
            {errors.token.message}
          </Alert>
        )}

        <div className="flex flex-col gap-tinyrack-sm">
          <AuthField
            autoComplete="new-password"
            error={errors.password}
            icon={LockIcon}
            label={t('resetPassword.password.label')}
            placeholder={t('resetPassword.password.placeholder')}
            {...register('password')}
            type="password"
          />

          <PasswordStrength password={passwordValue} policy={passwordPolicy} />
        </div>

        <AuthField
          autoComplete="new-password"
          error={errors.confirmPassword}
          icon={LockKeyholeIcon}
          label={t('resetPassword.confirmPassword.label')}
          placeholder={t('resetPassword.confirmPassword.placeholder')}
          {...register('confirmPassword')}
          type="password"
        />

        <TRButton
          className="w-full"
          intent="primary"
          loading={resetPasswordMutation.isPending}
          loadingLabel={t('resetPassword.submitting')}
          type="submit"
          uiSize="lg"
        >
          {t('resetPassword.submit')}
        </TRButton>
      </TRForm>

      <AuthFooter>
        <AuthFooterLink
          link={
            <Link data-testid="reset-password-back-to-login" to="/login">
              {t('resetPassword.backToLogin')}
            </Link>
          }
        />
      </AuthFooter>
    </AuthLayout>
  );
}

export function loader({ request, context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  if (!runtime.config.auth.password.enabled) throw redirect('/login');
  return createRouteLoaderData(
    runtime.queryClient,
    parseRequestSearch(request, SearchSchema),
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <NativeRouteErrorBoundary component={RouteErrorFallback} error={error} />
  );
}

export default function ResetPasswordRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <ResetPassword search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}
