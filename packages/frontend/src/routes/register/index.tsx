import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { EnvelopeSimpleIcon, LockIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { FooterLink } from '@/components/auth/footer-link.js';
import { IconInput } from '@/components/auth/icon-input.js';
import { OAuthButtons } from '@/components/auth/oauth-buttons.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { Divider } from '@/components/ui/divider.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise';
import {
  getOAuthConnectUrl,
  oauthProvidersQueryOptions,
} from '@/queries/oauth';
import { registerMutationOptions } from '@/queries/register';
import { getSessionQueryOptions } from '@/queries/session';

export const Route = createFileRoute('/register/')({
  component: Register,
  validateSearch: OAuthSearchSchema,
});

type RegisterFormValues = {
  email: string;
  password: string;
};

function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const { data: oauthProvidersData } = useQuery(oauthProvidersQueryOptions);
  const oauthProviders = oauthProvidersData?.providers || [];

  const registerSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('validation.email.invalid')),
        password: z
          .string()
          .min(6, t('validation.password.min'))
          .max(100, t('validation.password.max')),
      }),
    [t],
  );

  const registerMutation = useMutation({
    ...registerMutationOptions,
    onSuccess: async (data) => {
      if (data.user.email_verified) {
        queryClient.setQueryData(getSessionQueryOptions.queryKey, {
          user: data.user,
        });
        await tick();

        if (isOAuthFlow(search)) {
          window.location.href = buildAuthorizeUrl(search);
        } else {
          navigate({ to: '/profile' });
        }
      } else {
        await tick();
        navigate({
          to: '/verify-email',
          search: {
            email: data.user.email,
            token: '',
            ...extractOAuthParams(search),
          },
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: standardSchemaResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await registerMutation.mutateAsync(values);
    } catch {
      setError('email', {
        type: 'manual',
        message: t('register.error.emailExists'),
      });
    }
  };

  const buildOAuthUrl = (providerName: string) =>
    getOAuthConnectUrl(providerName, 'register');

  return (
    <AuthPageLayout>
      <PageHeader
        title={t('register.title')}
        subtitle={t('register.subtitle')}
      />

      <OAuthButtons providers={oauthProviders} buildUrl={buildOAuthUrl} />

      {oauthProviders.length > 0 && (
        <Divider text={t('register.divider.orSignUpWithEmail')} />
      )}

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

      <FooterLink
        text={t('register.footer.haveAccount')}
        linkText={t('register.link.login')}
        to="/login"
        search={extractOAuthParams(search)}
      />
    </AuthPageLayout>
  );
}
