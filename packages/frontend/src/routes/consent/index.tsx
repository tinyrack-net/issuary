import { ShieldCheckIcon, WarningIcon, XIcon } from '@phosphor-icons/react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { Alert } from '@/components/ui/alert.js';
import { OAuthSearchSchema } from '@/libs/oauth-search';
import {
  consentDecisionMutationOptions,
  getConsentInfoQueryOptions,
} from '@/queries/consent';

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

  if (consentInfoQuery.isError) {
    return (
      <AuthPageLayout>
        <Alert type="error" icon={WarningIcon} className="mb-4">
          {t('consent.error.title')}
        </Alert>
        <p className="mb-6 text-center text-base-content/70 text-sm">
          {t('consent.error.message')}
        </p>
        <button
          type="button"
          className="btn btn-block h-10 font-semibold text-[14px]"
          onClick={() => router.navigate({ to: '/' })}
        >
          {t('consent.error.back')}
        </button>
      </AuthPageLayout>
    );
  }

  const { client, scopes, user } = consentInfoQuery.data;

  return (
    <AuthPageLayout>
      <PageHeader
        title={t('consent.title')}
        subtitle={t('consent.subtitle', { app: client.name })}
      />

      {/* User info */}
      <div className="mb-4 rounded-lg bg-base-200 p-3 text-center">
        <p className="text-base-content/60 text-xs">
          {t('consent.loggedInAs')}
        </p>
        <p className="font-medium text-sm">{user.email}</p>
      </div>

      {/* Requested permissions */}
      <div className="mb-4">
        <h2 className="mb-3 font-semibold text-sm">
          {t('consent.permissions.title')}
        </h2>
        <ul className="flex flex-col gap-2">
          {scopes.map((scope: { name: string; description: string }) => (
            <li
              key={scope.name}
              className="flex items-start gap-3 rounded-lg bg-base-200 p-3"
            >
              <div className="mt-0.5 rounded-full bg-primary/20 p-1">
                <ShieldCheckIcon className="size-4 text-primary" weight="fill" />
              </div>
              <p className="font-medium text-sm">
                {t(`consent.scope.${scope.name}`, {
                  defaultValue: scope.description,
                })}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          className="btn btn-outline h-10 flex-1 font-semibold text-[14px]"
          onClick={handleDeny}
          disabled={consentMutation.isPending}
        >
          {consentMutation.isPending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <>
              <XIcon className="size-4" weight="bold" />
              {t('consent.deny')}
            </>
          )}
        </button>
        <button
          type="button"
          className="btn btn-primary h-10 flex-1 font-semibold text-[14px]"
          onClick={handleAllow}
          disabled={consentMutation.isPending}
        >
          {consentMutation.isPending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <>
              <ShieldCheckIcon className="size-4" weight="fill" />
              {t('consent.allow')}
            </>
          )}
        </button>
      </div>
    </AuthPageLayout>
  );
}
