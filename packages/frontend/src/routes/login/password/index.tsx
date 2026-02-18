import { FooterLink } from '@frontend/components/auth/footer-link.js';
import { IconInput } from '@frontend/components/auth/icon-input.js';
import { PageHeader } from '@frontend/components/auth/page-header.js';
import { SubmitButton } from '@frontend/components/auth/submit-button.js';
import { PageLayout } from '@frontend/components/ui/page-layout.js';
import { RouteErrorFallback } from '@frontend/components/ui/route-error-fallback.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
  type SecondFactorMethod,
} from '@frontend/libs/oauth-search.js';
import { tick } from '@frontend/libs/promise.js';
import { appConfigQueryOptions } from '@frontend/queries/config.js';
import { loginMutationOptions } from '@frontend/queries/login.js';
import { startConditionalPasskeyAuth } from '@frontend/queries/passkey.js';
import {
  type AuthResponse,
  getSessionQueryOptions,
} from '@frontend/queries/session.js';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { EnvelopeSimpleIcon, LockIcon } from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/login/password/')({
  component: LoginPassword,
  errorComponent: RouteErrorFallback,
  validateSearch: SearchSchema,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(appConfigQueryOptions);
  },
});

function LoginPassword() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const lang = search.lang ?? i18n.language;

  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);

  const customTitle =
    configData.app.title?.[lang] ??
    configData.app.title?.[configData.app.fallback_language];
  const customSubtitle =
    configData.app.subtitle?.[lang] ??
    configData.app.subtitle?.[configData.app.fallback_language];
  const isPasswordAuthEnabled = configData.auth.password.enabled;
  const isPasskeyEnabled = configData.auth.passkey.enabled;

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.email(t('validation.email.invalid')),
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
          window.location.href = buildAuthorizeUrl(search);
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
          window.location.href = buildAuthorizeUrl(search);
        } else {
          router.navigate({ to: '/profile' });
        }
      }
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
    [queryClient, router, search],
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
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        iconUrl={configData.app.icon_url}
        subtitle={customSubtitle ?? t('login.selectMethod.subtitle')}
        title={customTitle ?? t('login.title')}
      />

      {isPasswordAuthEnabled && (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <IconInput
            autoComplete="username webauthn"
            error={errors.email}
            icon={EnvelopeSimpleIcon}
            placeholder={t('login.email.placeholder')}
            {...register('email')}
            data-testid="login-password-email-input"
            type="email"
          />

          <IconInput
            autoComplete="current-password"
            error={errors.password}
            icon={LockIcon}
            placeholder={t('login.password.placeholder')}
            {...register('password')}
            data-testid="login-password-password-input"
            type="password"
          />

          {configData.smtp.enabled && (
            <div className="flex items-center justify-end">
              <Link
                className="link text-sm"
                data-testid="login-password-forgot-link"
                to="/password/forgot"
              >
                {t('login.link.forgotPassword')}
              </Link>
            </div>
          )}

          <SubmitButton
            className="mt-2"
            data-testid="login-password-submit-btn"
            isPending={loginMutation.isPending}
            pendingText={t('login.submitting')}
          >
            {t('login.submit')}
          </SubmitButton>
        </form>
      )}

      {configData.app.public_registration && (
        <FooterLink
          data-testid="login-password-register-link"
          linkText={t('login.link.register')}
          search={extractOAuthParams(search)}
          text={t('login.footer.noAccount')}
          to="/register"
        />
      )}

      {/* <div className="flex flex-col items-center gap-2">
        <Link
          to="/login"
          search={extractOAuthParams(search)}
          className="link text-sm"
        >
          {t('login.password.backToMethods')}
        </Link>
      </div> */}
    </PageLayout>
  );
}
