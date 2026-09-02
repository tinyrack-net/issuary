import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRForm } from '@tinyrack/ui/components/form';
import { TRLink } from '@tinyrack/ui/components/link';
import { LockIcon, MailIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthorizationContextBanner } from '#frontend/components/auth/authorization-context-banner.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { SanitizedRichText } from '#frontend/components/ui/sanitized-rich-text.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import { navigateDocument } from '#frontend/libs/document-navigation.ts';
import {
  buildAuthenticatedAuthorizeUrl,
  extractOAuthParams,
  hasAuthorizationContext,
  isOAuthFlow,
  type OAuthSearch,
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
import { createAuthorizationContextQueryOptions } from '#frontend/queries/authorization-context.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { loginMutationOptions } from '#frontend/queries/login.ts';
import { startConditionalPasskeyAuth } from '#frontend/queries/passkey.ts';
import {
  type AuthResponse,
  getSessionQueryOptions,
} from '#frontend/queries/session.ts';
import type { Route } from './+types/route.js';

const SearchSchema = OAuthSearchSchema;

function LoginPassword({
  search,
}: {
  search: ReturnType<typeof SearchSchema.parse>;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const navigateTo = useCallback(
    (to: string, params?: Record<string, unknown>) =>
      navigate(params ? hrefWithSearch(to, params) : to),
    [navigate],
  );
  const authorizeSearch: OAuthSearch =
    search.account_selection_state &&
    search.prompt?.split(' ').includes('login')
      ? { ...search, account_selected: 1 }
      : search;
  const lang = search.lang ?? i18n.language;

  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);

  const implicitNotice =
    configData.registration.signup_notice?.[lang] ??
    configData.registration.signup_notice?.[configData.i18n.fallback_language];
  const isPasswordAuthEnabled = configData.auth.password.enabled;
  const isPasskeyEnabled = configData.auth.passkey.enabled;
  const hasMultipleLoginMethods =
    configData.identity_providers.length +
      (isPasswordAuthEnabled ? 1 : 0) +
      (isPasskeyEnabled ? 1 : 0) >
    1;

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t('validation.email.required'))
          .pipe(z.email(t('validation.email.invalid'))),
        password: z.string().min(1, t('validation.password.required')),
      }),
    [t],
  );

  const loginMutation = useMutation({
    ...loginMutationOptions,
    onSuccess: async (data, params) => {
      const user = data.user;

      if (user.email_verification_required && !user.email_verified) {
        navigateTo('/verify/email', {
          email: params.email,
          ...extractOAuthParams(search),
        });
        return;
      }

      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: user,
      });
      await tick();

      const registered_2fa_methods: SecondFactorMethod[] = [];
      if (configData.auth.password.totp.enabled && user.totp_registered) {
        registered_2fa_methods.push('totp');
      }
      if (configData.auth.passkey.enabled && user.passkey_count > 0) {
        registered_2fa_methods.push('passkey');
      }

      if (user.second_factor_required && registered_2fa_methods.length === 0) {
        if (configData.available_2fa_setup_methods.length > 1) {
          return navigateTo('/setup/2fa', extractOAuthParams(search));
        } else if (configData.available_2fa_setup_methods.length === 1) {
          const method = configData.available_2fa_setup_methods[0];
          if (method === 'totp') {
            return navigateTo('/setup/totp', extractOAuthParams(search));
          } else {
            return navigateTo('/setup/passkey', {
              ...extractOAuthParams(search),
              passkey_name: 'default',
            });
          }
        }
      }

      if (registered_2fa_methods.length > 1) {
        return navigateTo('/verify/2fa', extractOAuthParams(search));
      } else if (registered_2fa_methods.length === 1) {
        const method = registered_2fa_methods[0];
        if (method === 'totp') {
          return navigateTo('/verify/totp', extractOAuthParams(search));
        } else {
          return navigateTo('/verify/passkey', extractOAuthParams(search));
        }
      } else {
        if (isOAuthFlow(search)) {
          navigateDocument(buildAuthenticatedAuthorizeUrl(authorizeSearch));
        } else {
          return navigate('/profile');
        }
      }
    },
    onError: (_error) => {
      setError('email', {
        type: 'manual',
        message: t('login.error.failed'),
      });
    },
  });

  const handlePasskeySuccess = useCallback(
    async (data: AuthResponse) => {
      if (data.user) {
        queryClient.setQueryData(getSessionQueryOptions.queryKey, data);
        await tick();

        if (isOAuthFlow(search)) {
          navigateDocument(buildAuthenticatedAuthorizeUrl(authorizeSearch));
        } else {
          navigate('/profile');
        }
      }
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
    [queryClient, navigate, search, authorizeSearch],
  );

  // Conditional UI: Start passkey autofill on page load
  const abortControllerRef = useRef<AbortController | null>(null);
  const handlePasskeySuccessRef = useRef(handlePasskeySuccess);

  useEffect(() => {
    handlePasskeySuccessRef.current = handlePasskeySuccess;
  }, [handlePasskeySuccess]);

  useEffect(() => {
    if (!isPasskeyEnabled || !isPasswordAuthEnabled) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    void startConditionalPasskeyAuth((data) => {
      void handlePasskeySuccessRef.current(data);
    }, controller.signal);

    return () => {
      controller.abort();
    };
  }, [isPasskeyEnabled, isPasswordAuthEnabled]);

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: standardSchemaResolver(loginSchema),
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    abortControllerRef.current?.abort();
    loginMutation.mutate(values);
  };

  return (
    <AuthLayout showBrandSubtitle>
      <AuthorizationContextBanner search={search} />

      {isPasswordAuthEnabled && (
        <TRForm
          className="flex flex-col gap-tinyrack-lg"
          onSubmit={handleSubmit(onSubmit)}
        >
          <AuthField
            autoComplete="username webauthn"
            error={errors.email}
            icon={MailIcon}
            label={t('login.email.label')}
            placeholder={t('login.email.placeholder')}
            {...register('email')}
            type="email"
          />

          <AuthField
            autoComplete="current-password"
            error={errors.password}
            icon={LockIcon}
            label={t('login.password.label')}
            /*
             * On the label row rather than under the field: it belongs to the
             * password, and putting it between the field and the submit button
             * separated the two things the user is actually trying to do.
             */
            labelAction={
              configData.email.enabled ? (
                <TRLink
                  className="text-tinyrack-xs"
                  render={<Link to="/password/forgot" />}
                >
                  {t('login.link.forgotPassword')}
                </TRLink>
              ) : undefined
            }
            placeholder={t('login.password.placeholder')}
            {...register('password')}
            type="password"
          />

          <TRButton
            className="w-full"
            intent="primary"
            loading={loginMutation.isPending}
            loadingLabel={t('login.submitting')}
            type="submit"
            uiSize="lg"
          >
            {t('login.submit')}
          </TRButton>
        </TRForm>
      )}

      {implicitNotice && (
        <SanitizedRichText html={implicitNotice} variant="notice" />
      )}

      {(configData.registration.public_registration ||
        hasMultipleLoginMethods) && (
        <AuthFooter>
          {configData.registration.public_registration && (
            <AuthFooterLink
              link={
                <Link
                  to={hrefWithSearch('/register', extractOAuthParams(search))}
                >
                  {t('login.link.register')}
                </Link>
              }
              text={t('login.footer.noAccount')}
            />
          )}
          {hasMultipleLoginMethods && (
            <AuthFooterLink
              link={
                <Link to={hrefWithSearch('/login', extractOAuthParams(search))}>
                  {t('login.password.backToMethods')}
                </Link>
              }
            />
          )}
        </AuthFooter>
      )}
    </AuthLayout>
  );
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  const search = parseRequestSearch(request, SearchSchema);
  if (hasAuthorizationContext(search)) {
    await runtime.queryClient.ensureQueryData(
      createAuthorizationContextQueryOptions(runtime.api, search),
    );
  }
  return createRouteLoaderData(runtime.queryClient, search);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <NativeRouteErrorBoundary component={RouteErrorFallback} error={error} />
  );
}

export default function LoginPasswordRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <LoginPassword search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}
