import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRIconButton } from '@tinyrack/ui/components/icon-button';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import {
  ArrowRightIcon,
  CircleUserRoundIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthChoiceRow } from '#frontend/components/auth/auth-choice-row.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { InitialAvatar } from '#frontend/components/ui/initial-avatar.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
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
    account_selected: 1,
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
      account_selected: 1,
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
    <AuthLayout width="wide">
      <AuthPageHeader
        subtitle={t('accountSelect.subtitle')}
        title={t('accountSelect.title')}
      />

      {data.accounts.length === 0 ? (
        <Alert icon={CircleUserRoundIcon} type="info">
          {accountSelectionUnavailable
            ? t('accountSelect.unavailable')
            : t('accountSelect.noRememberedAccounts')}
        </Alert>
      ) : (
        /* tinyrack-check-ignore-next-line components/no-native-text -- Structural account list; AuthChoiceRow owns visible typography. */
        <div
          className="flex flex-col gap-tinyrack-xs"
          data-testid="account-list"
        >
          {data.accounts.map((account) => (
            <div data-testid="remembered-account" key={account.sub}>
              <AuthChoiceRow
                description={
                  account.current
                    ? t('accountSelect.currentAccount')
                    : t('accountSelect.rememberedAccount')
                }
                label={account.email}
                leading={<InitialAvatar email={account.email} size="sm" />}
                /*
                  Picking an account is a mutation, not navigation, so this
                  one is a button. No children — the row supplies them.
                */
                render={
                  <TRButton
                    data-testid={`select-account-${account.sub}`}
                    disabled={selectMutation.isPending}
                    onClick={() => selectMutation.mutate({ sub: account.sub })}
                    type="button"
                    uiSize="lg"
                  />
                }
                trailing={
                  <>
                    {account.current ? (
                      <TRBadge uiSize="md" variant="info">
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
                        onClick={() =>
                          removeMutation.mutate({ sub: account.sub })
                        }
                        type="button"
                        uiSize="sm"
                      >
                        <Trash2Icon aria-hidden className="size-tinyrack-lg" />
                      </TRIconButton>
                    ) : null}
                  </>
                }
              />
            </div>
          ))}
        </div>
      )}

      {data.allow_add_account ? (
        <TRLinkButton
          appearance="outline"
          className="w-full justify-between"
          intent="neutral"
          render={<a href={buildLoginHref(search)} />}
          uiSize="lg"
        >
          <PlusIcon aria-hidden className="size-tinyrack-lg" />
          {t('accountSelect.useAnotherAccount')}
          <ArrowRightIcon aria-hidden className="size-tinyrack-lg" />
        </TRLinkButton>
      ) : null}
    </AuthLayout>
  );
}
