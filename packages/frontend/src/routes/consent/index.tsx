import { Moon, ShieldCheck, Sun, X } from '@phosphor-icons/react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { useTheme } from '@/hooks/use-theme';
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
  const { theme, toggleDarkMode } = useTheme();
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
      <div
        className="flex min-h-screen items-center justify-center bg-cover"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2071)',
        }}
      >
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (consentInfoQuery.isError) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-cover p-4"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2071)',
        }}
      >
        {/* Theme Toggle */}
        <label className="swap swap-rotate btn btn-sm btn-circle absolute start-4 top-4">
          <input
            type="checkbox"
            checked={theme === 'dark'}
            onChange={toggleDarkMode}
          />
          <Sun className="swap-off size-4" weight="fill" />
          <Moon className="swap-on size-4" weight="fill" />
        </label>

        <div className="card w-full max-w-100 border border-base-200 bg-base-100 p-12 shadow-lg">
          <div className="alert alert-error mb-4">
            <X className="size-5" weight="bold" />
            <span>{t('consent.error.title')}</span>
          </div>
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
        </div>
      </div>
    );
  }

  const { client, scopes, user } = consentInfoQuery.data;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover p-4"
      style={{
        backgroundImage:
          'url(https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2071)',
      }}
    >
      {/* Theme Toggle */}
      <label className="swap swap-rotate btn btn-sm btn-circle absolute start-4 top-4">
        <input
          type="checkbox"
          checked={theme === 'dark'}
          onChange={toggleDarkMode}
        />
        <Sun className="swap-off size-4" weight="fill" />
        <Moon className="swap-on size-4" weight="fill" />
      </label>

      <div className="card w-full max-w-100 border border-base-200 bg-base-100 p-12 shadow-lg">
        {/* Header */}
        <h1 className="mb-2 text-center font-bold text-3xl">
          {t('consent.title')}
        </h1>
        <p className="mb-6 text-center text-base-content/60 text-xs">
          {t('consent.subtitle', { app: client.name })}
        </p>

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
                  <ShieldCheck className="size-4 text-primary" weight="fill" />
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
                <X className="size-4" weight="bold" />
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
                <ShieldCheck className="size-4" weight="fill" />
                {t('consent.allow')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
