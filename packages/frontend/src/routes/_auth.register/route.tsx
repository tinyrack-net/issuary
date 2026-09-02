import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRForm } from '@tinyrack/ui/components/form';
import { LockIcon, MailIcon } from 'lucide-react';
import { useDeferredValue, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, replace, useNavigate } from 'react-router';
import { z } from 'zod';
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { AuthorizationContextBanner } from '#frontend/components/auth/authorization-context-banner.tsx';
import { PasswordStrength } from '#frontend/components/auth/password-strength.tsx';
import { TermsCheckboxList } from '#frontend/components/terms/terms-checkbox-list.tsx';
import { LabeledSeparator } from '#frontend/components/ui/labeled-separator.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { SanitizedRichText } from '#frontend/components/ui/sanitized-rich-text.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import { navigateDocument } from '#frontend/libs/document-navigation.ts';
import { IssuaryError } from '#frontend/libs/error.ts';
import {
  buildAuthenticatedAuthorizeUrl,
  extractOAuthParams,
  hasAuthorizationContext,
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
import { createAuthorizationContextQueryOptions } from '#frontend/queries/authorization-context.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { registerMutationOptions } from '#frontend/queries/register.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import {
  createTermsQueryOptions,
  getTermsQueryOptions,
} from '#frontend/queries/terms.ts';
import type { Route } from './+types/route.js';

function Register({
  search,
}: {
  search: ReturnType<typeof OAuthSearchSchema.parse>;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const navigateTo = (to: string, params?: Record<string, unknown>) =>
    navigate(params ? hrefWithSearch(to, params) : to);

  const lang = search.lang ?? i18n.language;
  const deferredLang = useDeferredValue(lang);

  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);
  const { data: termsData } = useSuspenseQuery(
    getTermsQueryOptions(deferredLang),
  );

  const isPasswordAuthEnabled = configData.auth.password.enabled;
  const passwordPolicy = configData.auth.password.policy;

  // Check if there are any terms to display
  const hasTerms = termsData.terms.length > 0;
  const explicitTerms = useMemo(
    () => termsData.terms.filter((term) => term.consentMode === 'explicit'),
    [termsData.terms],
  );
  const hasExplicitTerms = explicitTerms.length > 0;

  // Get implicit notice from config
  const implicitNotice =
    configData.registration.signup_notice?.[lang] ??
    configData.registration.signup_notice?.[configData.i18n.fallback_language];

  const registerSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t('validation.email.required'))
          .pipe(z.email(t('validation.email.invalid'))),
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
        termsConsents: z.object(
          Object.fromEntries(
            explicitTerms.map((term) => [
              term.id,
              term.required
                ? z.literal(true, {
                    message: t('validation.terms.required'),
                  })
                : z.boolean(),
            ]),
          ),
        ),
      }),
    [explicitTerms, passwordPolicy.max_length, passwordPolicy.min_length, t],
  );

  type RegisterFormValues = z.infer<typeof registerSchema>;

  const registerMutation = useMutation({
    ...registerMutationOptions,
    onSuccess: async (data, params) => {
      const user = data.user;

      if (user.email_verification_required && !user.email_verified) {
        return navigateTo('/verify/email', {
          email: params.email,
          ...extractOAuthParams(search),
        });
      }

      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: user,
      });
      await tick();

      if (user.second_factor_required) {
        const available_2fa_methods: SecondFactorMethod[] = [];
        if (configData.auth.password.totp.enabled) {
          available_2fa_methods.push('totp');
        }
        if (configData.auth.passkey.enabled) {
          available_2fa_methods.push('passkey');
        }

        if (available_2fa_methods.length === 1) {
          const method = available_2fa_methods[0];
          if (method === 'totp') {
            return navigateTo('/setup/totp', extractOAuthParams(search));
          } else {
            return navigateTo('/setup/passkey', {
              ...extractOAuthParams(search),
              passkey_name: 'default',
            });
          }
        } else {
          return navigateTo('/setup/2fa', extractOAuthParams(search));
        }
      }

      if (isOAuthFlow(search)) {
        navigateDocument(buildAuthenticatedAuthorizeUrl(search));
      } else {
        navigate('/profile');
      }
    },
    onError: (error) => {
      if (error instanceof IssuaryError) {
        if (error.code === 'REGISTRATION_EMAIL_NOT_ALLOWED') {
          setError('email', {
            type: 'manual',
            message: t('register.error.emailNotAllowed'),
          });
        } else if (error.code === 'REGISTRATION_DISABLED') {
          setError('email', {
            type: 'manual',
            message: t('register.error.registrationDisabled'),
          });
        } else {
          setError('email', {
            type: 'manual',
            message: t('register.error.emailExists'),
          });
        }
      } else {
        setError('email', {
          type: 'manual',
          message: t('register.error.emailExists'),
        });
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const {
    register,
    setError,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    defaultValues: {
      email: '',
      password: '',
      termsConsents: Object.fromEntries(
        explicitTerms.map((term) => [term.id, false]),
      ),
    },
    resolver: standardSchemaResolver(registerSchema),
    mode: 'onChange',
  });

  const passwordValue = watch('password');

  const onSubmit = (values: RegisterFormValues) => {
    // Build consents array for registration
    // Only send explicit consents - implicit ones are handled by backend
    const consents = hasTerms
      ? explicitTerms.map((term) => ({
          termsId: term.id,
          agreed: values.termsConsents[term.id] ?? false,
        }))
      : undefined;

    registerMutation.mutate({
      email: values.email,
      password: values.password,
      consents,
    });
  };

  return (
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('register.subtitle')}
        title={t('register.title')}
      />

      <AuthorizationContextBanner search={search} />

      {isPasswordAuthEnabled && (
        <TRForm
          className="flex flex-col gap-tinyrack-lg"
          onSubmit={handleSubmit(onSubmit)}
        >
          <AuthField
            autoComplete="email"
            error={errors.email}
            icon={MailIcon}
            label={t('register.email.label')}
            placeholder={t('register.email.placeholder')}
            {...register('email')}
            type="email"
          />

          <div className="flex flex-col gap-tinyrack-sm">
            <AuthField
              autoComplete="new-password"
              error={errors.password}
              hint={t('register.password.hint', {
                count: passwordPolicy.min_length,
              })}
              icon={LockIcon}
              label={t('register.password.label')}
              placeholder={t('register.password.placeholder')}
              {...register('password')}
              type="password"
            />

            <PasswordStrength
              password={passwordValue}
              policy={passwordPolicy}
            />
          </div>

          {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural terms group; descendants own visible typography. */}
          <div className="flex flex-col gap-tinyrack-md">
            {implicitNotice && (
              <div data-testid="terms-implicit-notice">
                <SanitizedRichText html={implicitNotice} variant="notice" />
              </div>
            )}

            {implicitNotice && hasExplicitTerms && (
              <LabeledSeparator label={t('terms.additionalOptionalConsent')} />
            )}

            {hasTerms && hasExplicitTerms && (
              <TermsCheckboxList
                control={control}
                disabled={registerMutation.isPending}
                errors={errors}
                setValue={setValue}
                terms={explicitTerms}
              />
            )}
          </div>

          <TRButton
            className="w-full"
            intent="primary"
            loading={registerMutation.isPending}
            loadingLabel={t('register.submitting')}
            type="submit"
            uiSize="lg"
          >
            {t('register.submit')}
          </TRButton>
        </TRForm>
      )}

      <AuthFooter>
        <AuthFooterLink
          link={
            <Link to={hrefWithSearch('/login', extractOAuthParams(search))}>
              {t('register.link.login')}
            </Link>
          }
          text={t('register.footer.haveAccount')}
        />
      </AuthFooter>
    </AuthLayout>
  );
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  if (!runtime.config.registration.public_registration) throw replace('/');
  const search = parseRequestSearch(request, OAuthSearchSchema);
  const lang = search.lang ?? runtime.i18n.language;
  const queries: Array<Promise<unknown>> = [
    runtime.queryClient.ensureQueryData(
      createTermsQueryOptions(runtime.api, lang),
    ),
  ];
  if (hasAuthorizationContext(search)) {
    queries.push(
      runtime.queryClient.ensureQueryData(
        createAuthorizationContextQueryOptions(runtime.api, search),
      ),
    );
  }
  await Promise.all(queries);
  return createRouteLoaderData(runtime.queryClient, search);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <NativeRouteErrorBoundary component={RouteErrorFallback} error={error} />
  );
}

export default function RegisterRoute({ loaderData }: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <Register search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}
