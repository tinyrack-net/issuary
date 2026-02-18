import { FooterLink } from '@frontend/components/auth/footer-link.js';
import { PageHeader } from '@frontend/components/auth/page-header.js';
import { SubmitButton } from '@frontend/components/auth/submit-button.js';
import { Alert } from '@frontend/components/ui/alert.js';
import { PageLayout } from '@frontend/components/ui/page-layout.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@frontend/libs/oauth-search.js';
import { tick } from '@frontend/libs/promise.js';
import { registerPasskeyMutationOptions } from '@frontend/queries/passkey.js';
import { getSessionQueryOptions } from '@frontend/queries/session.js';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  FingerprintIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

const SearchSchema = OAuthSearchSchema.extend({
  passkey_name: z.string().optional(),
});

export const Route = createFileRoute('/setup/passkey/')({
  component: SetupPasskey,
  validateSearch: SearchSchema,
});

type SetupStep = 'form' | 'registering' | 'error';

function SetupPasskey() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const [step, setStep] = useState<SetupStep>(
    search.passkey_name ? 'registering' : 'form',
  );
  const [errorMessage, setErrorMessage] = useState<string>('');
  const autoRegisterCalledRef = useRef(false);

  const formSchema = useMemo(
    () =>
      z.object({
        name: z.string().max(100, t('validation.passkey.name.max')),
      }),
    [t],
  );

  type FormValues = z.infer<typeof formSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '' },
    resolver: standardSchemaResolver(formSchema),
  });

  const registerMutation = useMutation({
    ...registerPasskeyMutationOptions,
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
        queryClient.invalidateQueries({
          queryKey: getSessionQueryOptions.queryKey,
        });
        router.navigate({ to: '/profile' });
      }
    },
    onError: (error) => {
      setStep('error');
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setErrorMessage(t('setupPasskey.error.cancelled'));
        } else {
          setErrorMessage(t('setupPasskey.error.failed'));
        }
      } else {
        setErrorMessage(t('setupPasskey.error.failed'));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  useEffect(() => {
    if (search.passkey_name && !autoRegisterCalledRef.current) {
      autoRegisterCalledRef.current = true;
      registerMutation.mutate({ name: search.passkey_name });
    }
  }, [registerMutation, search.passkey_name]);

  const onSubmit = (values: FormValues) => {
    setStep('registering');
    setErrorMessage('');
    registerMutation.mutate({ name: values.name || undefined });
  };

  // Registering state - waiting for WebAuthn
  if (step === 'registering') {
    return (
      <PageLayout cardPadding maxWidth="100">
        <PageHeader
          subtitle={t('setupPasskey.subtitle')}
          title={t('setupPasskey.title')}
        />
        <div className="flex flex-col items-center gap-4 py-8">
          <FingerprintIcon className="size-16 animate-pulse text-primary" />
          <p className="text-center text-base-content/70">
            {t('setupPasskey.waiting')}
          </p>
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <PageLayout cardPadding maxWidth="100">
        <PageHeader
          subtitle={t('setupPasskey.subtitle')}
          title={t('setupPasskey.title')}
        />
        <Alert icon={WarningCircleIcon} type="error">
          {errorMessage}
        </Alert>
        <button
          className="btn btn-primary btn-block mt-4"
          onClick={() => {
            if (search.passkey_name) {
              setStep('registering');
              setErrorMessage('');
              registerMutation.mutate({ name: search.passkey_name });
            } else {
              setStep('form');
            }
          }}
          type="button"
        >
          {t('setupPasskey.retry')}
        </button>
        <FooterLink
          linkText={t('setupPasskey.backToLogin')}
          search={extractOAuthParams(search)}
          text=""
          to="/login"
        />
      </PageLayout>
    );
  }

  // Form state
  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('setupPasskey.subtitle')}
        title={t('setupPasskey.title')}
      />

      <Alert icon={ShieldCheckIcon} type="info">
        {t('setupPasskey.required')}
      </Alert>

      <p className="mt-4 text-center text-base-content/60 text-sm">
        {t('setupPasskey.description')}
      </p>

      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="form-control">
          <label className="label" htmlFor="passkey-name">
            <span className="label-text">{t('setupPasskey.name.label')}</span>
          </label>
          <input
            className={`input input-bordered ${
              errors.name ? 'input-error' : ''
            }`}
            id="passkey-name"
            placeholder={t('setupPasskey.name.placeholder')}
            type="text"
            {...register('name')}
          />
          <span className="label-text-alt mt-1 text-base-content/50">
            {t('setupPasskey.name.hint')}
          </span>
          {errors.name && (
            <span className="label-text-alt mt-1 text-error">
              {errors.name.message}
            </span>
          )}
        </div>

        <SubmitButton
          className="mt-2"
          isPending={registerMutation.isPending}
          pendingText={t('setupPasskey.registering')}
        >
          {t('setupPasskey.continue')}
        </SubmitButton>
      </form>

      <FooterLink
        linkText={t('setupPasskey.backToLogin')}
        search={extractOAuthParams(search)}
        text=""
        to="/login"
      />
    </PageLayout>
  );
}
