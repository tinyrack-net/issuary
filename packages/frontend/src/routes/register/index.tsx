import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { EnvelopeSimpleIcon, LockIcon } from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { FooterLink } from '@/components/auth/footer-link.js';
import { IconInput } from '@/components/auth/icon-input.js';
import { OAuthButtons } from '@/components/auth/oauth-buttons.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { TermsCheckboxList } from '@/components/terms/terms-checkbox-list.js';
import { Divider } from '@/components/ui/divider.js';
import { PageLayout } from '@/components/ui/page-layout.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
  type SecondFactorMethod,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { appConfigQueryOptions } from '@/queries/config.js';
import { getOAuthConnectUrl } from '@/queries/oauth.js';
import { registerMutationOptions } from '@/queries/register.js';
import { getSessionQueryOptions } from '@/queries/session.js';
import { getTermsQueryOptions } from '@/queries/terms.js';

export const Route = createFileRoute('/register/')({
  component: Register,
  validateSearch: OAuthSearchSchema,
  beforeLoad: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(
      appConfigQueryOptions,
    );
    if (!config.app.public_registration) {
      throw redirect({
        to: '/',
        replace: true,
      });
    }
  },
  loaderDeps: ({ search }) => ({
    lang: search.lang,
  }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(appConfigQueryOptions),
      context.queryClient.ensureQueryData(getTermsQueryOptions(deps.lang)),
    ]);
  },
});

function Register() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const lang = search.lang ?? i18n.language;

  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);
  const { data: termsData } = useSuspenseQuery(getTermsQueryOptions(lang));
  const oauthProviders = configData.oauth_authentication_methods;

  const isPasswordAuthEnabled =
    configData.basic_authentication_methods.password.enabled;

  // Check if there are any terms to display
  const hasTerms = termsData.terms.length > 0;
  const explicitTerms = useMemo(
    () => termsData.terms.filter((term) => term.consentMode === 'explicit'),
    [termsData.terms],
  );
  const hasExplicitTerms = explicitTerms.length > 0;
  const hasImplicitTerms = termsData.terms.some(
    (term) => term.consentMode === 'implicit',
  );

  const registerSchema = useMemo(
    () =>
      z.object({
        email: z.email(t('validation.email.invalid')),
        password: z
          .string()
          .min(6, t('validation.password.min'))
          .max(100, t('validation.password.max')),
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
    [t, explicitTerms],
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
        if (configData.basic_authentication_methods.password.totp.enabled) {
          available_2fa_methods.push('totp');
        }
        if (configData.basic_authentication_methods.passkey.enabled) {
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
        window.location.href = buildAuthorizeUrl(search);
      } else {
        navigate({ to: '/profile' });
      }
    },
    onError: () => {
      setError('email', {
        type: 'manual',
        message: t('register.error.emailExists'),
      });
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

  const buildOAuthUrl = (providerId: string) =>
    getOAuthConnectUrl(providerId, 'register');

  return (
    <PageLayout maxWidth="100" cardPadding>
      <PageHeader
        title={t('register.title')}
        subtitle={t('register.subtitle')}
      />

      <OAuthButtons providers={oauthProviders} buildUrl={buildOAuthUrl} />

      {oauthProviders.length > 0 && isPasswordAuthEnabled && (
        <Divider text={t('register.divider.orSignUpWithEmail')} />
      )}

      {isPasswordAuthEnabled && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <IconInput
            icon={EnvelopeSimpleIcon}
            type="email"
            placeholder={t('register.email.placeholder')}
            autoComplete="email"
            error={errors.email}
            {...register('email')}
          />

          <IconInput
            icon={LockIcon}
            type="password"
            placeholder={t('register.password.placeholder')}
            autoComplete="new-password"
            error={errors.password}
            {...register('password')}
          />

          {/* Terms of Service - Explicit mode with checkboxes */}
          {hasTerms && hasExplicitTerms && (
            <div className="mt-2">
              <TermsCheckboxList
                terms={explicitTerms}
                control={control}
                setValue={setValue}
                errors={errors}
                disabled={registerMutation.isPending}
              />
            </div>
          )}

          {/* Terms of Service - Implicit mode notice */}
          {hasTerms && hasImplicitTerms && termsData.implicitNotice && (
            <div className="text-center text-base-content/60 text-xs">
              <div
                // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
                dangerouslySetInnerHTML={{
                  __html: termsData.implicitNotice,
                }}
              />
            </div>
          )}

          <SubmitButton
            isPending={registerMutation.isPending}
            pendingText={t('register.submitting')}
            className="mt-2"
          >
            {t('register.submit')}
          </SubmitButton>
        </form>
      )}

      <FooterLink
        text={t('register.footer.haveAccount')}
        linkText={t('register.link.login')}
        to="/login"
        search={extractOAuthParams(search)}
      />
    </PageLayout>
  );
}
