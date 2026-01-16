import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { ShieldCheckIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { FooterLink } from '@/components/auth/footer-link.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { SubmitButton } from '@/components/auth/submit-button.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { getSessionQueryOptions } from '@/queries/session.js';
import {
  startTotpSetupMutationOptions,
  type TotpSetupResponse,
  verifyTotpMutationOptions,
} from '@/queries/totp.js';

export const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/setup-totp/')({
  component: SetupTotp,
  validateSearch: SearchSchema,
});

type SetupStep = 'loading' | 'qr' | 'verify' | 'error';

type VerifyFormValues = {
  code: string;
};

function SetupTotp() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const [step, setStep] = useState<SetupStep>('loading');
  const [setupData, setSetupData] = useState<TotpSetupResponse | null>(null);
  const setupInitiatedRef = useRef(false);

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

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormValues>({
    defaultValues: { code: '' },
    resolver: standardSchemaResolver(verifySchema),
  });

  const setupMutation = useMutation({
    ...startTotpSetupMutationOptions,
    onSuccess: (data) => {
      setSetupData(data);
      setStep('qr');
    },
    onError: () => {
      setStep('error');
    },
  });

  const verifyMutation = useMutation({
    ...verifyTotpMutationOptions,
    onSuccess: async (data) => {
      if (data.second_factor_setup_completed && data.user) {
        queryClient.setQueryData(getSessionQueryOptions.queryKey, {
          user: data.user,
        });
        await tick();

        if (isOAuthFlow(search)) {
          window.location.href = buildAuthorizeUrl(search);
        } else {
          router.navigate({ to: '/profile' });
        }
      } else {
        // Regular TOTP setup from profile, just go to profile
        queryClient.invalidateQueries({
          queryKey: getSessionQueryOptions.queryKey,
        });
        router.navigate({ to: '/profile' });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const startSetup = useCallback(() => {
    setupInitiatedRef.current = true;
    setStep('loading');
    setupMutation.mutate();
  }, [setupMutation]);

  // Start setup on mount
  useEffect(() => {
    if (!setupInitiatedRef.current && step === 'loading') {
      setupInitiatedRef.current = true;
      setupMutation.mutate();
    }
  }, [step, setupMutation]);

  const onSubmit = async (values: VerifyFormValues) => {
    try {
      await verifyMutation.mutateAsync(values);
    } catch {
      setError('code', {
        type: 'manual',
        message: t('setupTotp.error.invalid'),
      });
    }
  };

  // Loading state
  if (step === 'loading') {
    return (
      <AuthPageLayout>
        <PageHeader
          title={t('setupTotp.title')}
          subtitle={t('setupTotp.subtitle')}
        />
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </AuthPageLayout>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <AuthPageLayout>
        <PageHeader
          title={t('setupTotp.title')}
          subtitle={t('setupTotp.subtitle')}
        />
        <div className="alert alert-error mb-4">
          <span>{t('setupTotp.error.setupFailed')}</span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={startSetup}
        >
          {t('setupTotp.retry')}
        </button>
        <FooterLink
          text=""
          linkText={t('setupTotp.backToLogin')}
          to="/login"
          search={extractOAuthParams(search)}
        />
      </AuthPageLayout>
    );
  }

  // QR code step
  if (step === 'qr' && setupData) {
    return (
      <AuthPageLayout>
        <PageHeader
          title={t('setupTotp.title')}
          subtitle={t('setupTotp.subtitle')}
        />

        <div className="alert alert-info mb-4">
          <ShieldCheckIcon className="size-5" weight="fill" />
          <span>{t('setupTotp.required')}</span>
        </div>

        <p className="mb-4 text-center text-base-content/60 text-sm">
          {t('setupTotp.qrDescription')}
        </p>

        <div className="mb-4 flex justify-center">
          <img
            src={setupData.qr_code}
            alt="TOTP QR Code"
            className="h-48 w-48 rounded-lg border"
          />
        </div>

        <div className="collapse-arrow collapse mb-4 bg-base-200">
          <input type="checkbox" />
          <div className="collapse-title font-medium text-sm">
            {t('setupTotp.manualEntry')}
          </div>
          <div className="collapse-content">
            <code className="block break-all rounded bg-base-300 p-2 text-xs">
              {setupData.secret}
            </code>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => setStep('verify')}
        >
          {t('setupTotp.next')}
        </button>

        <FooterLink
          text=""
          linkText={t('setupTotp.backToLogin')}
          to="/login"
          search={extractOAuthParams(search)}
        />
      </AuthPageLayout>
    );
  }

  // Verify step
  return (
    <AuthPageLayout>
      <PageHeader
        title={t('setupTotp.verifyTitle')}
        subtitle={t('setupTotp.verifySubtitle')}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="form-control">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            className={`input input-bordered text-center text-2xl tracking-widest ${
              errors.code ? 'input-error' : ''
            }`}
            placeholder="000000"
            autoComplete="one-time-code"
            {...register('code')}
          />
          {errors.code && (
            <span className="label-text-alt mt-1 text-error">
              {errors.code.message}
            </span>
          )}
        </div>

        <SubmitButton
          isPending={verifyMutation.isPending}
          pendingText={t('setupTotp.verifying')}
          className="mt-2"
        >
          {t('setupTotp.verify')}
        </SubmitButton>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setStep('qr')}
        >
          {t('setupTotp.back')}
        </button>
      </div>
    </AuthPageLayout>
  );
}
