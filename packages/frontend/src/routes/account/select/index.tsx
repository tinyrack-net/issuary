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
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(accountsQueryOptions(search.client_id));

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
        subtitle="Choose an account to continue to this application"
        title="Choose an account"
      />

      {data.accounts.length === 0 ? (
        <Alert className="mb-4" icon={UserCircleIcon} type="info">
          No remembered accounts are available in this browser session.
        </Alert>
      ) : (
        <div className="flex flex-col gap-2" data-testid="account-list">
          {data.accounts.map((account) => (
            <div
              className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3 shadow-sm"
              data-testid="remembered-account"
              key={account.sub}
            >
              <div className="avatar placeholder">
                <div className="w-10 rounded-full bg-primary/10 text-primary">
                  <UserCircleIcon className="size-7" weight="duotone" />
                </div>
              </div>
              <button
                className="min-w-0 flex-1 text-left"
                data-testid={`select-account-${account.sub}`}
                disabled={selectMutation.isPending}
                onClick={() => selectMutation.mutate({ sub: account.sub })}
                type="button"
              >
                <div className="truncate font-medium text-sm">
                  {account.email}
                </div>
                <div className="text-base-content/60 text-xs">
                  {account.current ? 'Current account' : 'Remembered account'}
                </div>
              </button>
              {account.current ? (
                <span className="badge badge-primary badge-sm">Current</span>
              ) : null}
              {data.allow_remove_account && !account.current ? (
                <button
                  aria-label={`Remove ${account.email}`}
                  className="btn btn-ghost btn-square btn-sm text-base-content/60"
                  data-testid={`remove-account-${account.sub}`}
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate({ sub: account.sub })}
                  type="button"
                >
                  <TrashIcon className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {data.allow_add_account ? (
        <a
          className="btn btn-outline mt-4 w-full justify-between"
          href={buildLoginHref(search)}
        >
          <span className="inline-flex items-center gap-2">
            <PlusIcon className="size-4" />
            Use another account
          </span>
          <ArrowRightIcon className="size-4" />
        </a>
      ) : null}
    </PageLayout>
  );
}
