import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRForm } from '@tinyrack/ui/components/form';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRText } from '@tinyrack/ui/components/text';
import {
  CircleAlertIcon,
  FingerprintIcon,
  ShieldCheckIcon,
  TagIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import { navigateDocument } from '#frontend/libs/document-navigation.ts';
import {
  buildAuthenticatedAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '#frontend/libs/oauth-search.ts';
import { classifyPasskeyError } from '#frontend/libs/passkey-error.ts';
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
import { registerPasskeyMutationOptions } from '#frontend/queries/passkey.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import type { Route } from './+types/route.js';

const SearchSchema = OAuthSearchSchema.extend({
  passkey_name: z.string().optional(),
});

type SetupStep = 'form' | 'registering' | 'error';

function SetupPasskey({ search }: { search: z.infer<typeof SearchSchema> }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: appConfig } = useSuspenseQuery(appConfigQueryOptions);

  const [step, setStep] = useState<SetupStep>(
    search.passkey_name ? 'registering' : 'form',
  );
  const [errorMessage, setErrorMessage] = useState<string>('');
  const autoRegisterCalledRef = useRef(false);
  const canUseTotpSetup =
    appConfig.auth.password.enabled &&
    appConfig.auth.password.two_factor.enrollment_required &&
    appConfig.auth.password.totp.enabled;

  const formSchema = useMemo(
    () =>
      z.object({
        name: z.string().max(100, t('validation.passkey.name.max')),
      }),
    [t],
  );

  type FormValues = z.infer<typeof formSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '' },
    resolver: standardSchemaResolver(formSchema),
  });

  const registerMutation = useMutation({
    ...registerPasskeyMutationOptions,
    onSuccess: async (data) => {
      if (data.second_factor_setup_completed && data.user) {
        queryClient.setQueryData(getSessionQueryOptions.queryKey, {
          user: data.user,
        });
        await tick();

        if (isOAuthFlow(search)) {
          navigateDocument(buildAuthenticatedAuthorizeUrl(search));
        } else {
          navigate('/profile');
        }
      } else {
        queryClient.invalidateQueries({
          queryKey: getSessionQueryOptions.queryKey,
        });
        navigate('/profile');
      }
    },
    onError: (error) => {
      setStep('error');
      const reason = classifyPasskeyError(error);

      switch (reason) {
        case 'unsupported':
          setErrorMessage(t('setupPasskey.error.unsupported'));
          return;
        case 'not_allowed':
          setErrorMessage(t('setupPasskey.error.notAllowed'));
          return;
        case 'expired':
          setErrorMessage(t('setupPasskey.error.expired'));
          return;
        case 'user_mismatch':
        case 'verification_failed':
          setErrorMessage(t('setupPasskey.error.failed'));
          return;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  useEffect(() => {
    if (search.passkey_name && !autoRegisterCalledRef.current) {
      autoRegisterCalledRef.current = true;
      registerMutation.mutate({ name: search.passkey_name });
    }
  }, [registerMutation, search.passkey_name]);

  const onSubmit = (values: FormValues) => {
    setStep('registering');
    setErrorMessage('');
    registerMutation.mutate({ name: values.name || undefined });
  };

  // Registering state - waiting for WebAuthn
  if (step === 'registering') {
    return (
      <AuthLayout>
        <AuthPageHeader
          subtitle={t('setupPasskey.subtitle')}
          title={t('setupPasskey.title')}
        />
        <div className="flex flex-col items-center gap-tinyrack-lg py-tinyrack-xl">
          <FingerprintIcon
            aria-hidden
            className="size-tinyrack-3xl animate-pulse text-tinyrack-primary-foreground"
          />
          <TRText align="center" as="p" color="muted" variant="body">
            {t('setupPasskey.waiting')}
          </TRText>
        </div>
      </AuthLayout>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <AuthLayout>
        <AuthPageHeader
          subtitle={t('setupPasskey.subtitle')}
          title={t('setupPasskey.title')}
        />
        <Alert icon={CircleAlertIcon} type="error">
          {errorMessage}
        </Alert>

        {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural action stack; controls own their typography. */}
        <div className="flex flex-col gap-tinyrack-sm">
          {canUseTotpSetup && (
            <TRLinkButton
              className="w-full gap-tinyrack-sm"
              intent="primary"
              render={
                <Link
                  to={hrefWithSearch('/setup/totp', extractOAuthParams(search))}
                />
              }
              uiSize="lg"
            >
              <ShieldCheckIcon aria-hidden className="size-tinyrack-xl" />
              {t('setupPasskey.useTotp')}
            </TRLinkButton>
          )}
          <TRButton
            appearance={canUseTotpSetup ? 'outline' : 'solid'}
            className="w-full"
            intent={canUseTotpSetup ? 'neutral' : 'primary'}
            onClick={() => {
              if (search.passkey_name) {
                setStep('registering');
                setErrorMessage('');
                registerMutation.mutate({ name: search.passkey_name });
              } else {
                setStep('form');
              }
            }}
            type="button"
            uiSize="lg"
          >
            {t('setupPasskey.retry')}
          </TRButton>
        </div>

        <AuthFooter>
          <AuthFooterLink
            link={
              <Link to={hrefWithSearch('/login', extractOAuthParams(search))}>
                {t('setupPasskey.backToLogin')}
              </Link>
            }
          />
        </AuthFooter>
      </AuthLayout>
    );
  }

  // Form state
  return (
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('setupPasskey.subtitle')}
        title={t('setupPasskey.title')}
      />

      <Alert icon={ShieldCheckIcon} type="info">
        {t('setupPasskey.required')}
      </Alert>

      <TRText align="center" as="p" color="muted" variant="bodySm">
        {t('setupPasskey.description')}
      </TRText>

      <TRForm
        className="flex flex-col gap-tinyrack-lg"
        onSubmit={handleSubmit(onSubmit)}
      >
        <AuthField
          error={errors.name}
          hint={t('setupPasskey.name.hint')}
          icon={TagIcon}
          id="passkey-name"
          label={t('setupPasskey.name.label')}
          placeholder={t('setupPasskey.name.placeholder')}
          {...register('name')}
          type="text"
        />

        <TRButton
          className="w-full"
          intent="primary"
          loading={registerMutation.isPending}
          loadingLabel={t('setupPasskey.registering')}
          type="submit"
          uiSize="lg"
        >
          {t('setupPasskey.continue')}
        </TRButton>
      </TRForm>

      <AuthFooter>
        <AuthFooterLink
          link={
            <Link to={hrefWithSearch('/login', extractOAuthParams(search))}>
              {t('setupPasskey.backToLogin')}
            </Link>
          }
        />
      </AuthFooter>
    </AuthLayout>
  );
}

export function loader({ request, context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
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

export default function SetupPasskeyRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <SetupPasskey search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}
