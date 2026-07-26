import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { TRSeparator } from '@tinyrack/ui/components/separator';
import { LockIcon, MailIcon } from 'lucide-react';
import { useDeferredValue, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthorizationContextBanner } from '#frontend/components/auth/authorization-context-banner.tsx';
import { FooterLink } from '#frontend/components/auth/footer-link.tsx';
import { IconInput } from '#frontend/components/auth/icon-input.tsx';
import { PageHeader } from '#frontend/components/auth/page-header.tsx';
import { SubmitButton } from '#frontend/components/auth/submit-button.tsx';
import { TermsCheckboxList } from '#frontend/components/terms/terms-checkbox-list.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';
import { TinyAuthError } from '#frontend/libs/error.ts';

import {
  buildAuthenticatedAuthorizeUrl,
  extractOAuthParams,
  hasAuthorizationContext,
  isOAuthFlow,
  OAuthSearchSchema,
  type SecondFactorMethod,
} from '#frontend/libs/oauth-search.ts';
import { tick } from '#frontend/libs/promise.ts';
import { getAuthorizationContextQueryOptions } from '#frontend/queries/authorization-context.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { registerMutationOptions } from '#frontend/queries/register.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import { getTermsQueryOptions } from '#frontend/queries/terms.ts';

export const Route = createFileRoute('/register/')({
  component: Register,
  errorComponent: RouteErrorFallback,
  validateSearch: OAuthSearchSchema,
  beforeLoad: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(
      appConfigQueryOptions,
    );
    if (!config.registration.public_registration) {
      throw redirect({
        to: '/',
        replace: true,
      });
    }
  },
  loaderDeps: ({ search }) => ({
    lang: search.lang,
    search,
  }),
  loader: async ({ context, deps }) => {
    const lang = deps.lang ?? context.i18n.language;
    const queries: Array<Promise<unknown>> = [
      context.queryClient.ensureQueryData(appConfigQueryOptions),
      context.queryClient.ensureQueryData(getTermsQueryOptions(lang)),
    ];

    if (hasAuthorizationContext(deps.search)) {
      queries.push(
        context.queryClient.ensureQueryData(
          getAuthorizationContextQueryOptions(deps.search),
        ),
      );
    }

    await Promise.all(queries);
  },
});

function Register() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

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
        email: z.email(t('validation.email.invalid')),
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
        return navigate({
          to: '/verify/email',
          search: {
            email: params.email,
            ...extractOAuthParams(search),
          },
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
            return navigate({
              to: '/setup/totp',
              search: extractOAuthParams(search),
            });
          } else {
            return navigate({
              to: '/setup/passkey',
              search: {
                ...extractOAuthParams(search),
                passkey_name: 'default',
              },
            });
          }
        } else {
          return navigate({
            to: '/setup/2fa',
            search: extractOAuthParams(search),
          });
        }
      }

      if (isOAuthFlow(search)) {
        window.location.href = buildAuthenticatedAuthorizeUrl(search);
      } else {
        navigate({ to: '/profile' });
      }
    },
    onError: (error) => {
      if (error instanceof TinyAuthError) {
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
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('register.subtitle')}
        title={t('register.title')}
      />

      <AuthorizationContextBanner search={search} />

      {isPasswordAuthEnabled && (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <IconInput
            autoComplete="email"
            error={errors.email}
            icon={MailIcon}
            label={t('register.email.label')}
            placeholder={t('register.email.placeholder')}
            {...register('email')}
            type="email"
          />

          <IconInput
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

          <div className="flex flex-col">
            {implicitNotice && (
              <div className="text-center text-tinyrack-text-muted text-tinyrack-xs">
                <div
                  className="prose prose-sm text-xs! **:text-xs!"
                  dangerouslySetInnerHTML={{
                    __html: implicitNotice,
                  }}
                  data-testid="terms-implicit-notice"
                />
              </div>
            )}

            {implicitNotice && hasExplicitTerms && (
              <div className="flex items-center gap-2 text-tinyrack-xs">
                <TRSeparator className="flex-1" />
                <span className="text-tinyrack-text-muted">
                  {t('terms.additionalOptionalConsent')}
                </span>
                <TRSeparator className="flex-1" />
              </div>
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

          <SubmitButton
            className="mt-6"
            isPending={registerMutation.isPending}
            pendingText={t('register.submitting')}
          >
            {t('register.submit')}
          </SubmitButton>
        </form>
      )}

      <FooterLink
        as={Link}
        linkText={t('register.link.login')}
        search={extractOAuthParams(search)}
        text={t('register.footer.haveAccount')}
        to="/login"
      />
    </PageLayout>
  );
}
