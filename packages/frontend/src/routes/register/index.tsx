import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { FooterLink } from '@/components/auth/footer-link.js';
import { IconInput } from '@/components/auth/icon-input.js';
import { OAuthButtons } from '@/components/auth/oauth-buttons.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { Divider } from '@/components/ui/divider.js';
import {
  OAuthSearchSchema,
  type SecondFactorMethod,
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { appConfigQueryOptions } from '@/queries/config.js';
import {
  getOAuthConnectUrl,
  oauthProvidersQueryOptions,
} from '@/queries/oauth.js';
import { registerMutationOptions } from '@/queries/register.js';
import { getSessionQueryOptions } from '@/queries/session.js';
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
});

function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);
  const { data: oauthProvidersData } = useSuspenseQuery(
    oauthProvidersQueryOptions,
  );
  const oauthProviders = oauthProvidersData.providers;

  const isPasswordAuthEnabled =
    configData.basic_authentication_methods.password.enabled;

  const registerSchema = useMemo(
    () =>
      z.object({
        email: z.email(t('validation.email.invalid')),
        password: z
          .string()
          .min(6, t('validation.password.min'))
          .max(100, t('validation.password.max')),
      }),
    [t],
  );

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
              search: extractOAuthParams(search),
            });
          }
        } else {
          return navigate({
            to: '/setup/2fa',
            search: {
              ...extractOAuthParams(search),
              methods: available_2fa_methods,
            },
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
    formState: { errors },
  } = useForm<z.infer<typeof registerSchema>>({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: standardSchemaResolver(registerSchema),
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    registerMutation.mutate(values);
  };

  const buildOAuthUrl = (providerId: string) =>
    getOAuthConnectUrl(providerId, 'register');

  return (
    <AuthPageLayout>
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
    </AuthPageLayout>
  );
}
