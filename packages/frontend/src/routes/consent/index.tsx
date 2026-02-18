import { PageHeader } from '@frontend/components/auth/page-header.js';
import { PageLayout } from '@frontend/components/ui/page-layout.js';
import { RouteErrorFallback } from '@frontend/components/ui/route-error-fallback.js';
import {
  buildAuthorizeUrl,
  OAuthSearchSchema,
} from '@frontend/libs/oauth-search';
import {
  consentDecisionMutationOptions,
  getConsentInfoQueryOptions,
} from '@frontend/queries/consent';
import { ShieldCheckIcon, XIcon } from '@phosphor-icons/react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

const ConsentSearchSchema = OAuthSearchSchema.extend({
  client_id: z.string(),
  redirect_uri: z.string(),
  response_type: z.string(),
});

export const Route = createFileRoute('/consent/')({
  component: Consent,
  errorComponent: ConsentError,
  validateSearch: ConsentSearchSchema,
  loaderDeps: ({ search }) => ({
    client_id: search.client_id,
    scope: search.scope,
  }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(
      getConsentInfoQueryOptions({
        client_id: deps.client_id,
        scope: deps.scope,
      }),
    );
  },
});

function ConsentError(props: ErrorComponentProps) {
  return (
    <RouteErrorFallback
      {...props}
      onUnauthorized={() => {
        // Re-enter the OAuth flow from the beginning so the
        // user can log in and be redirected back through
        // /oauth/authorize -> /consent/.
        const params = new URLSearchParams(window.location.search);
        const search = Object.fromEntries(params.entries());
        window.location.href = buildAuthorizeUrl(search);
      }}
    />
  );
}

function Consent() {
  const { t } = useTranslation();
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

  const { client, scopes, user } = consentInfoQuery.data;

  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('consent.subtitle', { app: client.name })}
        title={t('consent.title')}
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
              className="flex items-start gap-3 rounded-lg bg-base-200 p-3"
              key={scope.name}
            >
              <div className="mt-0.5 rounded-full bg-primary/20 p-1">
                <ShieldCheckIcon
                  className="size-4 text-primary"
                  weight="fill"
                />
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
          className="btn btn-outline h-10 flex-1 font-semibold text-[14px]"
          data-testid="consent-deny-btn"
          disabled={consentMutation.isPending}
          onClick={handleDeny}
          type="button"
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
          className="btn btn-primary h-10 flex-1 font-semibold text-[14px]"
          data-testid="consent-allow-btn"
          disabled={consentMutation.isPending}
          onClick={handleAllow}
          type="button"
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
    </PageLayout>
  );
}
