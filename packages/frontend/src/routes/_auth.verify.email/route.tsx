import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRForm } from '@tinyrack/ui/components/form';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { TRText } from '@tinyrack/ui/components/text';
import { TRToast } from '@tinyrack/ui/components/toast';
import { CircleCheckIcon, KeyRoundIcon, MailIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { redirect, useNavigate } from 'react-router';
import { z } from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import { AuthOutcome } from '#frontend/components/auth/auth-outcome.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { LabeledSeparator } from '#frontend/components/ui/labeled-separator.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import { navigateDocument } from '#frontend/libs/document-navigation.ts';
import {
  buildAuthenticatedAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
  type SecondFactorMethod,
} from '#frontend/libs/oauth-search.ts';
import { tick } from '#frontend/libs/promise.ts';
import {
  createRouteLoaderData,
  hrefWithSearch,
  NativeRouteErrorBoundary,
  parseRequestSearch,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import {
  resendVerificationMutationOptions,
  verifyEmailMutationOptions,
} from '#frontend/queries/verify-email.ts';
import type { Route } from './+types/route.js';

const SearchSchema = z.object({
  ...OAuthSearchSchema.shape,
  token: z.string().default(''),
  email: z.string().default(''),
});

type VerifyEmailFormValues = {
  token: string;
};

function VerifyEmail({ search }: { search: z.infer<typeof SearchSchema> }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const navigateTo = (to: string, params?: Record<string, unknown>) =>
    navigate(params ? hrefWithSearch(to, params) : to);
  const { token: queryToken, email } = search;
  const [verified, setVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);
  const toast = TRToast.useToastManager();
  const { data: appConfig } = useSuspenseQuery(appConfigQueryOptions);

  const verifyEmailSchema = useMemo(
    () =>
      z.object({
        token: z.string().min(1, t('validation.token.required')),
      }),
    [t],
  );

  const verifyEmailMutation = useMutation({
    ...verifyEmailMutationOptions,
    onSuccess: async (data) => {
      const user = data.user;

      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: user,
      });
      await tick();

      if (user.second_factor_required) {
        const available_2fa_methods: SecondFactorMethod[] = [];
        if (appConfig.auth.password.totp.enabled) {
          available_2fa_methods.push('totp');
        }
        if (appConfig.auth.passkey.enabled) {
          available_2fa_methods.push('passkey');
        }

        if (available_2fa_methods.length === 1) {
          const method = available_2fa_methods[0];
          if (method === 'totp') {
            return navigateTo('/setup/totp', extractOAuthParams(search));
          } else {
            return navigateTo('/setup/passkey', extractOAuthParams(search));
          }
        } else {
          return navigateTo('/setup/2fa', extractOAuthParams(search));
        }
      }

      if (isOAuthFlow(search)) {
        navigateDocument(buildAuthenticatedAuthorizeUrl(search));
      } else {
        setVerified(true);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const resendVerificationMutation = useMutation({
    ...resendVerificationMutationOptions,
    onSuccess: () => {
      toast.add({ title: t('verifyEmail.resendSuccess'), type: 'success' });
      // Separate from the message: a short cooldown so the button cannot be
      // used to spam the address with mail.
      setResendCooldown(true);
      setTimeout(() => setResendCooldown(false), 5000);
    },
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyEmailFormValues>({
    defaultValues: {
      token: queryToken || '',
    },
    resolver: standardSchemaResolver(verifyEmailSchema),
  });

  const onSubmit = async (values: VerifyEmailFormValues) => {
    try {
      await verifyEmailMutation.mutateAsync(values);
    } catch (_error) {
      setError('token', {
        type: 'manual',
        message: t('verifyEmail.error.invalidToken'),
      });
    }
  };

  const handleResend = async () => {
    if (!email) {
      return;
    }
    try {
      await resendVerificationMutation.mutateAsync({ email });
    } catch (_error) {}
  };

  if (verified) {
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
                {t('verifyEmail.success.subtitle')}
                <br />
                {t('verifyEmail.success.description')}
              </>
            }
            icon={CircleCheckIcon}
            title={t('verifyEmail.success.title')}
            tone="success"
          >
            <TRButton
              className="w-full"
              data-testid="email-verify-go-profile"
              intent="primary"
              onClick={() => navigate('/profile')}
              type="button"
              uiSize="lg"
            >
              {t('verifyEmail.success.goToProfile')}
            </TRButton>
          </AuthOutcome>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('verifyEmail.subtitle')}
        title={t('verifyEmail.title')}
      />

      {email && (
        <Alert icon={MailIcon} type="info">
          <span className="flex flex-col gap-tinyrack-3xs text-left">
            <TRText variant="body" weight="strong">
              {t('register.success.subtitle')}
            </TRText>
            <TRText color="muted" variant="caption">
              {t('register.success.description', { email })}
            </TRText>
          </span>
        </Alert>
      )}

      <TRForm
        className="flex flex-col gap-tinyrack-lg"
        onSubmit={handleSubmit(onSubmit)}
      >
        <AuthField
          error={errors.token}
          icon={KeyRoundIcon}
          label={t('verifyEmail.token.label')}
          placeholder={t('verifyEmail.token.placeholder')}
          {...register('token')}
          type="text"
        />

        <TRButton
          className="w-full"
          intent="primary"
          loading={verifyEmailMutation.isPending}
          loadingLabel={t('verifyEmail.submitting')}
          type="submit"
          uiSize="lg"
        >
          {t('verifyEmail.submit')}
        </TRButton>
      </TRForm>

      {email && (
        <div className="flex flex-col gap-tinyrack-md">
          <LabeledSeparator />

          <TRButton
            appearance="ghost"
            className="w-full"
            data-testid="email-verify-resend"
            disabled={resendVerificationMutation.isPending || resendCooldown}
            intent="neutral"
            onClick={handleResend}
            type="button"
            uiSize="lg"
          >
            {resendVerificationMutation.isPending ? (
              <>
                <TRSpinner uiSize="sm" />
                {t('verifyEmail.resending')}
              </>
            ) : (
              t('verifyEmail.resend')
            )}
          </TRButton>
        </div>
      )}
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

export default function VerifyEmailRoute({ loaderData }: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <VerifyEmail search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}
