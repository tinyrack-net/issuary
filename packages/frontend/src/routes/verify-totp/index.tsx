import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { ShieldCheckIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { FooterLink } from '@/components/auth/footer-link.js';
import { IconInput } from '@/components/auth/icon-input.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { ApiError } from '@/libs/error.js';
import {
  buildAuthorizeUrl,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { getSessionQueryOptions } from '@/queries/session.js';
import { verifyTotpLoginMutationOptions } from '@/queries/totp.js';

export const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/verify-totp/')({
  component: VerifyTotp,
  validateSearch: SearchSchema,
});

type VerifyTotpFormValues = {
  code: string;
};

function VerifyTotp() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const verifySchema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .length(6, t('validation.totp.length'))
          .regex(/^\d{6}$/, t('validation.totp.digits')),
      }),
    [t],
  );

  const verifyMutation = useMutation({
    ...verifyTotpLoginMutationOptions,
    onSuccess: async (data) => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: data.user,
      });
      await tick();

      if (isOAuthFlow(search)) {
        window.location.href = buildAuthorizeUrl(search);
      } else {
        router.navigate({ to: '/profile' });
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
  } = useForm<VerifyTotpFormValues>({
    defaultValues: {
      code: '',
    },
    resolver: standardSchemaResolver(verifySchema),
  });

  const onSubmit = async (values: VerifyTotpFormValues) => {
    try {
      await verifyMutation.mutateAsync(values);
    } catch (error) {
      console.error('TOTP verification failed:', error);
      if (error instanceof ApiError) {
        if (error.code === 'TOTP_VERIFICATION_SESSION_EXPIRED') {
          setError('code', {
            type: 'manual',
            message: t('verifyTotp.error.expired'),
          });
          return;
        }
      }
      setError('code', {
        type: 'manual',
        message: t('verifyTotp.error.invalid'),
      });
    }
  };

  return (
    <AuthPageLayout>
      <PageHeader
        title={t('verifyTotp.title')}
        subtitle={t('verifyTotp.subtitle')}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <IconInput
          icon={ShieldCheckIcon}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder={t('verifyTotp.code.placeholder')}
          autoComplete="one-time-code"
          autoFocus
          error={errors.code}
          {...register('code')}
        />

        <SubmitButton
          isPending={verifyMutation.isPending}
          pendingText={t('verifyTotp.submitting')}
          className="mt-2"
        >
          {t('verifyTotp.submit')}
        </SubmitButton>
      </form>

      <FooterLink
        text=""
        linkText={t('verifyTotp.backToLogin')}
        to="/login"
        search={search}
      />
    </AuthPageLayout>
  );
}
