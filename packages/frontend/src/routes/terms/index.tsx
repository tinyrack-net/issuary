import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { CheckIcon, WarningIcon } from '@phosphor-icons/react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { PageHeader } from '@/components/auth/page-header.js';
import { TermsCheckboxList } from '@/components/terms/terms-checkbox-list.js';
import { Alert } from '@/components/ui/alert.js';
import { PageLayout } from '@/components/ui/page-layout.js';
import { OAuthSearchSchema } from '@/libs/oauth-search';
import { appConfigQueryOptions } from '@/queries/config';
import {
  getTermsQueryOptions,
  type TermsConsentItem,
  termsConsentMutationOptions,
} from '@/queries/terms.js';

const TermsSearchSchema = OAuthSearchSchema.extend({
  redirect: z.string().optional(),
  lang: z.string().optional(),
  mode: z.enum(['normal', 'complete_registration']).optional(),
});

export const Route = createFileRoute('/terms/')({
  component: Terms,
  validateSearch: TermsSearchSchema,
  beforeLoad: async ({ context, search }) => {
    // When mode=complete_registration, user is completing OAuth signup
    // They have pendingOAuthRegistration session but are not logged in yet
    // Skip auth check in this case - backend will validate the session
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
  const search = Route.useSearch();

  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);
  const lang = search.lang ?? i18n.language;
  const termsQuery = useSuspenseQuery(getTermsQueryOptions(lang));
  const implicitNotice =
    configData.app.signup_implicit_terms?.[lang] ??
    configData.app.signup_implicit_terms?.[configData.app.fallback_language];

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

  type TermsFormValues = z.infer<typeof termsSchema>;

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
    onSuccess: () => {
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
    });
  };

  if (termsQuery.isError) {
    return (
      <PageLayout maxWidth="100" cardPadding>
        <Alert type="error" icon={WarningIcon} className="mb-4">
          {t('terms.error.title')}
        </Alert>
        <p className="mb-6 text-center text-base-content/70 text-sm">
          {t('terms.error.message')}
        </p>
        <button
          type="button"
          className="btn btn-block h-10 font-semibold text-[14px]"
          onClick={() => router.navigate({ to: '/' })}
        >
          {t('terms.error.back')}
        </button>
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="100" cardPadding>
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
              terms={explicitTerms}
              control={control}
              setValue={setValue}
              errors={errors}
              disabled={consentMutation.isPending}
            />
          </div>
        )}

        {/* Error message */}
        {consentMutation.isError && (
          <Alert type="error" icon={WarningIcon} className="mb-4">
            {t('terms.error.submitFailed')}
          </Alert>
        )}

        {/* Submit button */}
        <button
          type="submit"
          className="btn btn-primary btn-block h-10 font-semibold text-[14px]"
          disabled={consentMutation.isPending}
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
