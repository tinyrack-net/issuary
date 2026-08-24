import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRText } from '@tinyrack/ui/components/text';
import { ShieldCheckIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { InitialAvatar } from '#frontend/components/ui/initial-avatar.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import {
  buildAuthorizeUrl,
  OAuthSearchSchema,
} from '#frontend/libs/oauth-search.ts';
import {
  consentDecisionMutationOptions,
  getConsentInfoQueryOptions,
} from '#frontend/queries/consent.ts';

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
      prompt: search.prompt,
      max_age: search.max_age,
      reauthenticated: search.reauthenticated,
      display: search.display,
      response_mode: search.response_mode,
      login_hint: search.login_hint,
      ui_locales: search.ui_locales,
      id_token_hint: search.id_token_hint,
      acr_values: search.acr_values,
      account_selected: search.account_selected,
      account_selection_state: search.account_selection_state,
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
      prompt: search.prompt,
      max_age: search.max_age,
      reauthenticated: search.reauthenticated,
      display: search.display,
      response_mode: search.response_mode,
      login_hint: search.login_hint,
      ui_locales: search.ui_locales,
      id_token_hint: search.id_token_hint,
      acr_values: search.acr_values,
      account_selected: search.account_selected,
      account_selection_state: search.account_selection_state,
      decision: 'deny',
    });
  };

  const { client, scopes, user } = consentInfoQuery.data;

  return (
    <AuthLayout width="wide">
      <AuthPageHeader
        subtitle={t('consent.subtitle', { app: client.name })}
        title={t('consent.title')}
      />

      {/*
        Who is about to hand out access. The decision is meaningless without
        it, so it sits above the scopes rather than in fine print.
      */}
      <TRCard.Root padding="lg" variant="outlined">
        <TRCard.Content className="flex items-center gap-tinyrack-md">
          <InitialAvatar email={user.email} size="sm" />
          <span className="flex min-w-0 flex-col">
            <TRText color="muted" variant="caption">
              {t('consent.loggedInAs')}
            </TRText>
            <TRText
              data-testid="consent-user-email"
              truncate
              variant="body"
              weight="medium"
            >
              {user.email}
            </TRText>
          </span>
        </TRCard.Content>
      </TRCard.Root>

      {/* Requested permissions */}
      <div className="flex flex-col gap-tinyrack-sm">
        <TRText as="h3" variant="label">
          {t('consent.permissions.title')}
        </TRText>
        <ul
          className="flex flex-col gap-tinyrack-xs"
          data-testid="consent-scope-list"
        >
          {scopes.map((scope: { name: string; description: string }) => (
            <li
              className="flex items-center gap-tinyrack-sm rounded-tinyrack-md bg-tinyrack-surface-muted px-tinyrack-md py-tinyrack-sm"
              key={scope.name}
            >
              <ShieldCheckIcon
                aria-hidden
                className="size-tinyrack-lg shrink-0 text-tinyrack-info"
              />
              <TRText variant="body">
                {t(`consent.scope.${scope.name}`, {
                  defaultValue: scope.description,
                })}
              </TRText>
            </li>
          ))}
        </ul>
      </div>

      {/*
        Sticky so the decision stays reachable when a client asks for a long
        list of scopes and the page scrolls.
      */}
      <div className="sticky bottom-0 flex gap-tinyrack-sm border-tinyrack-border border-t-tinyrack-default bg-tinyrack-surface/80 py-tinyrack-md backdrop-blur-sm">
        <TRButton
          appearance="outline"
          className="flex-1"
          data-testid="consent-deny"
          intent="neutral"
          loading={consentMutation.isPending}
          loadingLabel={t('consent.deny')}
          onClick={handleDeny}
          type="button"
          uiSize="lg"
        >
          <XIcon aria-hidden className="size-tinyrack-lg" />
          {t('consent.deny')}
        </TRButton>
        <TRButton
          className="flex-1"
          data-testid="consent-allow"
          intent="primary"
          loading={consentMutation.isPending}
          loadingLabel={t('consent.allow')}
          onClick={handleAllow}
          type="button"
          uiSize="lg"
        >
          <ShieldCheckIcon aria-hidden className="size-tinyrack-lg" />
          {t('consent.allow')}
        </TRButton>
      </div>
    </AuthLayout>
  );
}
