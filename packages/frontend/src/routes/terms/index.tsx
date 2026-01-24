import { Check as CheckIcon, WarningIcon } from '@phosphor-icons/react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { PageHeader } from '@/components/auth/page-header';
import { TermsCheckboxList } from '@/components/terms/terms-checkbox-list';
import { Alert } from '@/components/ui/alert';
import { PageLayout } from '@/components/ui/page-layout';
import {
  getTermsQueryOptions,
  termsConsentMutationOptions,
} from '@/queries/terms';

const TermsSearchSchema = z.object({
  redirect: z.string().optional(),
  lang: z.string().optional(),
});

export const Route = createFileRoute('/terms/')({
  component: Terms,
  validateSearch: TermsSearchSchema,
  loaderDeps: ({ search }) => ({
    lang: search.lang,
  }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(getTermsQueryOptions(deps.lang));
  },
});

function Terms() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const search = Route.useSearch();

  const lang = search.lang ?? i18n.language;

  const termsQuery = useSuspenseQuery(getTermsQueryOptions(lang));

  const [consents, setConsents] = useState<Record<string, boolean>>(() => {
    // Initialize with existing consents
    const initial: Record<string, boolean> = {};
    for (const term of termsQuery.data.terms) {
      if (term.userConsent?.agreed && !term.userConsent.requiresUpdate) {
        initial[term.id] = true;
      } else {
        initial[term.id] = false;
      }
    }
    return initial;
  });

  const handleConsentChange = useCallback(
    (termsId: string, agreed: boolean) => {
      setConsents((prev) => ({
        ...prev,
        [termsId]: agreed,
      }));
    },
    [],
  );

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

  const handleSubmit = () => {
    const consentItems = Object.entries(consents).map(([termsId, agreed]) => ({
      termsId,
      agreed,
    }));

    consentMutation.mutate({
      consents: consentItems,
    });
  };

  // Check if all required terms are agreed
  const allRequiredAgreed = useMemo(() => {
    return termsQuery.data.terms
      .filter((term) => term.required)
      .every((term) => consents[term.id]);
  }, [termsQuery.data.terms, consents]);

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
      <PageHeader title={t('terms.title')} subtitle={t('terms.subtitle')} />

      {/* Terms list */}
      <div className="mb-6">
        <TermsCheckboxList
          terms={termsQuery.data.terms}
          values={consents}
          onChange={handleConsentChange}
          disabled={consentMutation.isPending}
        />
      </div>

      {/* Error message */}
      {consentMutation.isError && (
        <Alert type="error" icon={WarningIcon} className="mb-4">
          {t('terms.error.submitFailed')}
        </Alert>
      )}

      {/* Submit button */}
      <button
        type="button"
        className="btn btn-primary btn-block h-10 font-semibold text-[14px]"
        onClick={handleSubmit}
        disabled={!allRequiredAgreed || consentMutation.isPending}
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
    </PageLayout>
  );
}
