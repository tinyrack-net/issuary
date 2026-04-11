import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { CheckIcon, WarningIcon } from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { PageHeader } from '#frontend/components/auth/page-header.tsx';
import {
  TermsCheckboxList,
  type TermsConsentsField,
} from '#frontend/components/terms/terms-checkbox-list.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';
import { OAuthSearchSchema } from '#frontend/libs/oauth-search.ts';
import { tick } from '#frontend/libs/promise.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import {
  getTermsQueryOptions,
  type TermsConsentItem,
  termsConsentMutationOptions,
} from '#frontend/queries/terms.ts';

const TermsSearchSchema = OAuthSearchSchema.extend({
  redirect: z.string().optional(),
  lang: z.string().optional(),
  mode: z.enum(['normal', 'complete_registration']).optional(),
  registration_token: z.string().optional(),
});

function TermsError(props: ErrorComponentProps) {
  return (
    <RouteErrorFallback
      {...props}
      onUnauthorized={() => {
        window.location.href = '/login';
      }}
    />
  );
}

export const Route = createFileRoute('/terms/')({
  component: Terms,
  errorComponent: TermsError,
  validateSearch: TermsSearchSchema,
  beforeLoad: async ({ context, search }) => {
    // When mode=complete_registration, user is completing OAuth signup.
    // The registration_token in the URL references a DB record with OAuth data.
    // Skip auth check — backend will validate the token on consent submission.
    if (search.mode === 'complete_registration') {
      return;
    }

    // Standard mode: requires authentication
    // Users are redirected here after OAuth login when they need to agree to terms
    if (!context.user) {
      throw redirect({
        to: '/login',
      });
    }
  },
  loaderDeps: ({ search }) => ({
    lang: search.lang,
  }),
  loader: async ({ context, deps }) => {
    const lang = deps.lang ?? context.i18n.language;
    await Promise.all([
      context.queryClient.ensureQueryData(getTermsQueryOptions(lang)),
      context.queryClient.ensureQueryData(appConfigQueryOptions),
    ]);
  },
});

function Terms() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);
  const lang = search.lang ?? i18n.language;
  const termsQuery = useSuspenseQuery(getTermsQueryOptions(lang));
  const implicitNotice =
    configData.registration.signup_notice?.[lang] ??
    configData.registration.signup_notice?.[configData.i18n.fallback_language];

  // Separate explicit and implicit terms
  const explicitTerms = useMemo(
    () =>
      termsQuery.data.terms.filter((term) => term.consentMode === 'explicit'),
    [termsQuery.data.terms],
  );

  const implicitTerms = useMemo(
    () =>
      termsQuery.data.terms.filter((term) => term.consentMode === 'implicit'),
    [termsQuery.data.terms],
  );

  const hasExplicitTerms = explicitTerms.length > 0;

  // Schema only validates explicit terms (implicit are auto-agreed)
  const termsSchema = useMemo(
    () =>
      z.object({
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

  type TermsFormValues = TermsConsentsField;

  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<TermsFormValues>({
    defaultValues: {
      termsConsents: Object.fromEntries(
        explicitTerms.map((term) => [
          term.id,
          !!(term.userConsent?.agreed && !term.userConsent.requiresUpdate),
        ]),
      ),
    },
    resolver: standardSchemaResolver(termsSchema),
    mode: 'onChange',
  });

  const consentMutation = useMutation({
    ...termsConsentMutationOptions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
      await queryClient.fetchQuery(getSessionQueryOptions);
      await tick();

      // Redirect after successful consent
      if (search.redirect) {
        window.location.href = search.redirect;
      } else {
        router.navigate({ to: '/profile' });
      }
    },
  });

  const onSubmit = (values: TermsFormValues) => {
    const explicitConsents = Object.entries(
      values.termsConsents,
    ).map<TermsConsentItem>(([termsId, agreed]) => ({
      termsId,
      agreed,
      consentType: 'explicit',
    }));

    const implicitConsents = implicitTerms.map<TermsConsentItem>((term) => ({
      termsId: term.id,
      agreed: true,
      consentType: 'implicit',
    }));

    consentMutation.mutate({
      consents: [...explicitConsents, ...implicitConsents],
      ...(search.registration_token && {
        registrationToken: search.registration_token,
      }),
    });
  };

  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader title={t('terms.title')} />

      {implicitNotice && (
        <div className="text-center text-base-content/60 text-xs">
          <div
            className="prose prose-sm text-xs! **:text-xs!"
            dangerouslySetInnerHTML={{ __html: implicitNotice }}
          />
        </div>
      )}

      {implicitNotice && hasExplicitTerms && (
        <div className="divider text-xs">AND</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Explicit terms with checkboxes */}
        {hasExplicitTerms && (
          <div className="mb-6">
            <TermsCheckboxList
              control={control}
              disabled={consentMutation.isPending}
              errors={errors}
              setValue={setValue}
              terms={explicitTerms}
            />
          </div>
        )}

        {/* Error message */}
        {consentMutation.isError && (
          <Alert className="mb-4" icon={WarningIcon} type="error">
            {t('terms.error.submitFailed')}
          </Alert>
        )}

        {/* Submit button */}
        <button
          className="btn btn-primary btn-block h-10 font-semibold text-[14px]"
          disabled={consentMutation.isPending}
          type="submit"
        >
          {consentMutation.isPending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <>
              <CheckIcon className="size-4" weight="bold" />
              {t('terms.submit')}
            </>
          )}
        </button>
      </form>
    </PageLayout>
  );
}
