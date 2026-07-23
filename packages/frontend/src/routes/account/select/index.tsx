import {
  ArrowRightIcon,
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
} from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRIconButton } from '@tinyrack/ui/components/icon-button';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '#frontend/components/auth/page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  OAuthSearchSchema,
} from '#frontend/libs/oauth-search.ts';
import {
  accountsQueryOptions,
  removeAccountMutationOptions,
  selectAccountMutationOptions,
} from '#frontend/queries/accounts.ts';
import { queryKeys } from '#frontend/queries/keys.ts';

export const Route = createFileRoute('/account/select/')({
  component: AccountSelect,
  errorComponent: RouteErrorFallback,
  validateSearch: OAuthSearchSchema,
  loader: async ({ context, location }) => {
    const search = location.search as { client_id?: string };
    await context.queryClient.ensureQueryData(
      accountsQueryOptions(search.client_id),
    );
  },
});

function appendLoginPrompt(prompt: string | undefined): string {
  const values = prompt?.split(' ').filter(Boolean) ?? [];
  if (!values.includes('login')) {
    values.push('login');
  }
  return values.join(' ');
}

function buildLoginHref(search: ReturnType<typeof Route.useSearch>) {
  const oauthParams = extractOAuthParams(search);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    ...oauthParams,
    prompt: appendLoginPrompt(oauthParams.prompt),
    account_selected: '1',
  })) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  return `/login?${params.toString()}`;
}

function AccountSelect() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(accountsQueryOptions(search.client_id));
  const accountSelectionUnavailable =
    data.accounts.length === 0 && !data.allow_add_account;

  const continueWithSelectedAccount = () => {
    window.location.href = buildAuthorizeUrl({
      ...search,
      account_selected: '1',
    });
  };

  const selectMutation = useMutation({
    ...selectAccountMutationOptions,
    onSuccess: continueWithSelectedAccount,
  });
  const removeMutation = useMutation({
    ...removeAccountMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.accounts(search.client_id),
      });
    },
  });

  return (
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('accountSelect.subtitle')}
        title={t('accountSelect.title')}
      />

      {data.accounts.length === 0 ? (
        <Alert className="mb-4" icon={UserCircleIcon} type="info">
          {accountSelectionUnavailable
            ? t('accountSelect.unavailable')
            : t('accountSelect.noRememberedAccounts')}
        </Alert>
      ) : (
        <div className="flex flex-col gap-2" data-testid="account-list">
          {data.accounts.map((account) => (
            <div
              className="flex items-center gap-3 rounded-tinyrack-lg border border-tinyrack-border bg-tinyrack-surface p-3"
              data-testid="remembered-account"
              key={account.sub}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-tinyrack-full bg-tinyrack-surface-muted text-tinyrack-text-muted">
                <UserCircleIcon className="size-7" weight="duotone" />
              </div>
              <button
                className="min-w-0 flex-1 text-left"
                data-testid={`select-account-${account.sub}`}
                disabled={selectMutation.isPending}
                onClick={() => selectMutation.mutate({ sub: account.sub })}
                type="button"
              >
                <div className="truncate font-medium text-tinyrack-sm text-tinyrack-text">
                  {account.email}
                </div>
                <div className="text-tinyrack-text-muted text-tinyrack-xs">
                  {account.current
                    ? t('accountSelect.currentAccount')
                    : t('accountSelect.rememberedAccount')}
                </div>
              </button>
              {account.current ? (
                <TRBadge uiSize="sm" variant="info">
                  {t('accountSelect.current')}
                </TRBadge>
              ) : null}
              {data.allow_remove_account && !account.current ? (
                <TRIconButton
                  appearance="ghost"
                  aria-label={t('accountSelect.removeAccount', {
                    email: account.email,
                  })}
                  data-testid={`remove-account-${account.sub}`}
                  disabled={removeMutation.isPending}
                  intent="neutral"
                  onClick={() => removeMutation.mutate({ sub: account.sub })}
                  type="button"
                  uiSize="sm"
                >
                  <TrashIcon className="size-4" />
                </TRIconButton>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {data.allow_add_account ? (
        <TRLinkButton
          appearance="outline"
          className="mt-4 w-full justify-between"
          intent="neutral"
          render={<a href={buildLoginHref(search)} />}
        >
          <span className="inline-flex items-center gap-2">
            <PlusIcon className="size-4" />
            {t('accountSelect.useAnotherAccount')}
          </span>
          <ArrowRightIcon className="size-4" />
        </TRLinkButton>
      ) : null}
    </PageLayout>
  );
}
