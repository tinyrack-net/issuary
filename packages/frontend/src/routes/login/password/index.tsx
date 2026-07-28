import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRLink } from '@tinyrack/ui/components/link';
import { LockIcon, MailIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { AuthorizationContextBanner } from '#frontend/components/auth/authorization-context-banner.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
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
import { getAuthorizationContextQueryOptions } from '#frontend/queries/authorization-context.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { loginMutationOptions } from '#frontend/queries/login.ts';
import { startConditionalPasskeyAuth } from '#frontend/queries/passkey.ts';
import {
  type AuthResponse,
  getSessionQueryOptions,
} from '#frontend/queries/session.ts';

const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/login/password/')({
  component: LoginPassword,
  errorComponent: RouteErrorFallback,
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => ({
    search,
  }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(appConfigQueryOptions);
    if (hasAuthorizationContext(deps.search)) {
      await context.queryClient.ensureQueryData(
        getAuthorizationContextQueryOptions(deps.search),
      );
    }
  },
});

function LoginPassword() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
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
        router.navigate({
          to: '/verify/email',
          search: {
            email: params.email,
            ...extractOAuthParams(search),
          },
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
          return router.navigate({
            to: '/setup/2fa',
            search: extractOAuthParams(search),
          });
        } else if (configData.available_2fa_setup_methods.length === 1) {
          const method = configData.available_2fa_setup_methods[0];
          if (method === 'totp') {
            return router.navigate({
              to: '/setup/totp',
              search: extractOAuthParams(search),
            });
          } else {
            return router.navigate({
              to: '/setup/passkey',
              search: {
                ...extractOAuthParams(search),
                passkey_name: 'default',
              },
            });
          }
        }
      }

      if (registered_2fa_methods.length > 1) {
        return router.navigate({
          to: '/verify/2fa',
          search: extractOAuthParams(search),
        });
      } else if (registered_2fa_methods.length === 1) {
        const method = registered_2fa_methods[0];
        if (method === 'totp') {
          return router.navigate({
            to: '/verify/totp',
            search: extractOAuthParams(search),
          });
        } else {
          return router.navigate({
            to: '/verify/passkey',
            search: extractOAuthParams(search),
          });
        }
      } else {
        if (isOAuthFlow(search)) {
          window.location.href =
            buildAuthenticatedAuthorizeUrl(authorizeSearch);
        } else {
          return router.navigate({ to: '/profile' });
        }
      }
    },
    onError: (_error) => {
      setError('email', {
        type: 'manual',
        message: t('login.error.failed'),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const handlePasskeySuccess = useCallback(
    async (data: AuthResponse) => {
      if (data.user) {
        queryClient.setQueryData(getSessionQueryOptions.queryKey, data);
        await tick();

        if (isOAuthFlow(search)) {
          window.location.href =
            buildAuthenticatedAuthorizeUrl(authorizeSearch);
        } else {
          router.navigate({ to: '/profile' });
        }
      }
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
    [queryClient, router, search, authorizeSearch],
  );

  // Conditional UI: Start passkey autofill on page load
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isPasskeyEnabled || !isPasswordAuthEnabled) {
      return;
    }

    abortControllerRef.current = new AbortController();
    startConditionalPasskeyAuth(
      handlePasskeySuccess,
      abortControllerRef.current.signal,
    );

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [isPasskeyEnabled, isPasswordAuthEnabled, handlePasskeySuccess]);

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

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(values);
  };

  return (
    <AuthLayout>
      {/* Branding lives in the layout's brand panel — see /login. */}
      <AuthPageHeader
        subtitle={t('login.selectMethod.subtitle') || undefined}
        title={t('login.title')}
      />

      <AuthorizationContextBanner search={search} />

      {isPasswordAuthEnabled && (
        <form
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
        </form>
      )}

      {implicitNotice && (
        <div
          className="prose prose-sm text-center text-tinyrack-text-muted text-xs! **:text-xs!"
          dangerouslySetInnerHTML={{ __html: implicitNotice }}
        />
      )}

      {(configData.registration.public_registration ||
        hasMultipleLoginMethods) && (
        <AuthFooter>
          {configData.registration.public_registration && (
            <AuthFooterLink
              link={
                <Link search={extractOAuthParams(search)} to="/register">
                  {t('login.link.register')}
                </Link>
              }
              text={t('login.footer.noAccount')}
            />
          )}
          {hasMultipleLoginMethods && (
            <AuthFooterLink
              link={
                <Link search={extractOAuthParams(search)} to="/login">
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
