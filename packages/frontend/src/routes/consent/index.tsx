import { GlobeIcon, ShieldCheckIcon, XIcon } from '@phosphor-icons/react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useLanguage } from '@/hooks/use-language';
import { OAuthSearchSchema } from '@/libs/oauth-search';
import {
  consentDecisionMutationOptions,
  getConsentInfoQueryOptions,
} from '@/queries/consent';

// Consent page requires client_id and redirect_uri
const ConsentSearchSchema = OAuthSearchSchema.extend({
  client_id: z.string(),
  redirect_uri: z.string(),
  response_type: z.string(),
});

export const Route = createFileRoute('/consent/')({
  component: Consent,
  validateSearch: ConsentSearchSchema,
});

function Consent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, languages, setLanguage } = useLanguage();
  const search = Route.useSearch();

  const consentInfoQuery = useSuspenseQuery(
    getConsentInfoQueryOptions({
      client_id: search.client_id,
      scope: search.scope,
    }),
  );

  const consentMutation = useMutation({
    ...consentDecisionMutationOptions,
    onSuccess: (data) => {
      // Redirect to the URL returned by the server
      window.location.href = data.redirect_url;
    },
  });

  const handleAllow = () => {
    consentMutation.mutate({
      client_id: search.client_id,
      redirect_uri: search.redirect_uri,
      response_type: search.response_type,
      scope: search.scope,
      state: search.state,
      nonce: search.nonce,
      code_challenge: search.code_challenge,
      code_challenge_method: search.code_challenge_method,
      decision: 'allow',
    });
  };

  const handleDeny = () => {
    consentMutation.mutate({
      client_id: search.client_id,
      redirect_uri: search.redirect_uri,
      response_type: search.response_type,
      scope: search.scope,
      state: search.state,
      nonce: search.nonce,
      code_challenge: search.code_challenge,
      code_challenge_method: search.code_challenge_method,
      decision: 'deny',
    });
  };

  if (consentInfoQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-base-200 to-base-300">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (consentInfoQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-base-200 to-base-300 p-4">
        <div className="card bg-base-100 shadow-2xl">
          <div className="card-body p-8 text-center">
            <h1 className="font-bold text-2xl text-error">
              {t('consent.error.title')}
            </h1>
            <p className="text-base-content/70">{t('consent.error.message')}</p>
            <button
              type="button"
              className="btn btn-primary mt-4"
              onClick={() => router.navigate({ to: '/' })}
            >
              {t('consent.error.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { client, scopes, user } = consentInfoQuery.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-base-200 to-base-300 p-4">
      <div className="w-full max-w-md">
        <div className="card bg-base-100 shadow-2xl">
          <div className="card-body gap-6 p-8">
            {/* Header */}
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <ShieldCheckIcon
                    size={48}
                    weight="duotone"
                    className="text-primary"
                  />
                </div>
              </div>
              <h1 className="mb-2 font-bold text-2xl tracking-tight">
                {t('consent.title')}
              </h1>
              <p className="text-base-content/70 text-sm">
                {t('consent.subtitle', { app: client.name })}
              </p>
            </div>

            {/* User info */}
            <div className="rounded-lg bg-base-200 p-3 text-center">
              <p className="text-base-content/70 text-xs">
                {t('consent.loggedInAs')}
              </p>
              <p className="font-medium text-sm">{user.email}</p>
            </div>

            {/* Requested permissions */}
            <div>
              <h2 className="mb-3 font-semibold text-sm">
                {t('consent.permissions.title')}
              </h2>
              <ul className="space-y-2">
                {scopes.map((scope: { name: string; description: string }) => (
                  <li
                    key={scope.name}
                    className="flex items-start gap-3 rounded-lg bg-base-200 p-3"
                  >
                    <div className="mt-0.5 rounded-full bg-primary/20 p-1">
                      <ShieldCheckIcon
                        size={16}
                        weight="fill"
                        className="text-primary"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {t(`consent.scope.${scope.name}`, {
                          defaultValue: scope.description,
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={handleDeny}
                disabled={consentMutation.isPending}
              >
                {consentMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <>
                    <XIcon size={18} weight="bold" />
                    {t('consent.deny')}
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={handleAllow}
                disabled={consentMutation.isPending}
              >
                {consentMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <>
                    <ShieldCheckIcon size={18} weight="fill" />
                    {t('consent.allow')}
                  </>
                )}
              </button>
            </div>

            {/* Language Selector */}
            <div className="flex items-center justify-center gap-3">
              <GlobeIcon
                size={18}
                weight="regular"
                className="text-base-content/50"
              />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
                className="select select-bordered select-sm w-auto min-w-35 font-medium"
                aria-label={t('common.language.select')}
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {t(
                      `common.language.${
                        lang === 'ko'
                          ? 'korean'
                          : lang === 'en'
                            ? 'english'
                            : 'japanese'
                      }`,
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
