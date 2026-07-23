import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  FingerprintIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { FooterLink } from '#frontend/components/auth/footer-link.tsx';
import { PageHeader } from '#frontend/components/auth/page-header.tsx';
import { SubmitButton } from '#frontend/components/auth/submit-button.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';
import {
  buildAuthenticatedAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '#frontend/libs/oauth-search.ts';
import { classifyPasskeyError } from '#frontend/libs/passkey-error.ts';
import { tick } from '#frontend/libs/promise.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { registerPasskeyMutationOptions } from '#frontend/queries/passkey.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';

const SearchSchema = OAuthSearchSchema.extend({
  passkey_name: z.string().optional(),
});

export const Route = createFileRoute('/setup/passkey/')({
  component: SetupPasskey,
  errorComponent: RouteErrorFallback,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(appConfigQueryOptions);
  },
  validateSearch: SearchSchema,
});

type SetupStep = 'form' | 'registering' | 'error';

function SetupPasskey() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const { data: appConfig } = useSuspenseQuery(appConfigQueryOptions);

  const [step, setStep] = useState<SetupStep>(
    search.passkey_name ? 'registering' : 'form',
  );
  const [errorMessage, setErrorMessage] = useState<string>('');
  const autoRegisterCalledRef = useRef(false);
  const canUseTotpSetup =
    appConfig.auth.password.enabled &&
    appConfig.auth.password.two_factor.enrollment_required &&
    appConfig.auth.password.totp.enabled;

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
          window.location.href = buildAuthenticatedAuthorizeUrl(search);
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
      const reason = classifyPasskeyError(error);

      switch (reason) {
        case 'unsupported':
          setErrorMessage(t('setupPasskey.error.unsupported'));
          return;
        case 'not_allowed':
          setErrorMessage(t('setupPasskey.error.notAllowed'));
          return;
        case 'expired':
          setErrorMessage(t('setupPasskey.error.expired'));
          return;
        case 'user_mismatch':
        case 'verification_failed':
          setErrorMessage(t('setupPasskey.error.failed'));
          return;
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
          <FingerprintIcon className="size-16 animate-pulse text-tinyrack-primary" />
          <p className="text-center text-tinyrack-text-muted">
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
        {canUseTotpSetup && (
          <TRLinkButton
            className="mt-4 w-full gap-2"
            intent="primary"
            render={
              <Link search={extractOAuthParams(search)} to="/setup/totp" />
            }
          >
            <ShieldCheckIcon className="size-5" weight="regular" />
            {t('setupPasskey.useTotp')}
          </TRLinkButton>
        )}
        <TRButton
          appearance={canUseTotpSetup ? 'outline' : 'solid'}
          className="mt-4 w-full"
          intent={canUseTotpSetup ? 'neutral' : 'primary'}
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
        </TRButton>
        <FooterLink
          as={Link}
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

      <p className="mt-4 text-center text-tinyrack-sm text-tinyrack-text-muted">
        {t('setupPasskey.description')}
      </p>

      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <TRField.Root uiSize="md">
          <TRField.Label htmlFor="passkey-name">
            {t('setupPasskey.name.label')}
          </TRField.Label>
          <TRInput
            aria-invalid={errors.name ? true : undefined}
            data-invalid={errors.name ? '' : undefined}
            id="passkey-name"
            placeholder={t('setupPasskey.name.placeholder')}
            type="text"
            {...register('name')}
          />
          {!errors.name && (
            <TRField.Description>
              {t('setupPasskey.name.hint')}
            </TRField.Description>
          )}
          {errors.name && (
            <div className="tr-field-error" data-testid="field-error">
              {errors.name.message}
            </div>
          )}
        </TRField.Root>

        <SubmitButton
          className="mt-2"
          isPending={registerMutation.isPending}
          pendingText={t('setupPasskey.registering')}
        >
          {t('setupPasskey.continue')}
        </SubmitButton>
      </form>

      <FooterLink
        as={Link}
        linkText={t('setupPasskey.backToLogin')}
        search={extractOAuthParams(search)}
        text=""
        to="/login"
      />
    </PageLayout>
  );
}
