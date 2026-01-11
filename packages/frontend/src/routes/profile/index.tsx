import {
  CheckCircleIcon,
  EnvelopeIcon,
  LinkIcon,
  UserIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tick } from '@/libs/promise';
import { logoutMutationOptions } from '@/queries/logout';
import {
  getOAuthConnectUrl,
  oauthAccountsQueryOptions,
  unlinkOAuthMutationOptions,
} from '@/queries/oauth';
import { getSessionQueryOptions } from '@/queries/session';

export const Route = createFileRoute('/profile/')({
  component: Profile,
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({
        to: '/login',
      });
    }
  },
});

function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(
    null,
  );

  const { data: session } = useQuery(getSessionQueryOptions);
  const { data: oauthAccountsData } = useQuery(oauthAccountsQueryOptions);

  const logoutMutation = useMutation({
    ...logoutMutationOptions,
    onSuccess: async () => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: null,
      });
      await tick();
      router.navigate({
        to: '/login',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const unlinkMutation = useMutation({
    ...unlinkOAuthMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: oauthAccountsQueryOptions.queryKey,
      });
    },
    onSettled: () => {
      setUnlinkingProvider(null);
    },
  });

  const handleUnlink = async (providerName: string) => {
    if (
      !window.confirm(
        t('profile.linkedAccounts.unlinkConfirm', { provider: providerName }),
      )
    ) {
      return;
    }
    setUnlinkingProvider(providerName);
    try {
      await unlinkMutation.mutateAsync(providerName);
    } catch {
      alert(t('profile.linkedAccounts.unlinkError'));
    }
  };

  const user = session?.user;
  const availableProviders = oauthAccountsData?.available_providers || [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-base-200 to-base-300 p-4">
      <div className="w-full max-w-md">
        <div className="card bg-base-100 shadow-2xl">
          <div className="card-body gap-6 p-8">
            <div className="text-center">
              <h1 className="mb-2 font-bold text-4xl tracking-tight">
                {t('profile.title')}
              </h1>
              <p className="text-base-content/70 text-sm">
                {t('profile.subtitle')}
              </p>
            </div>

            {user && (
              <div className="space-y-4">
                <div className="card bg-base-200">
                  <div className="card-body gap-4 p-4">
                    <div className="flex items-center gap-3">
                      <UserIcon
                        size={24}
                        weight="regular"
                        className="text-primary"
                      />
                      <div className="flex-1">
                        <div className="text-base-content/60 text-sm">
                          {t('profile.id.label')}
                        </div>
                        <div className="font-medium">{user.id}</div>
                      </div>
                    </div>

                    <div className="divider my-1" />

                    <div className="flex items-center gap-3">
                      <EnvelopeIcon
                        size={24}
                        weight="regular"
                        className="text-primary"
                      />
                      <div className="flex-1">
                        <div className="text-base-content/60 text-sm">
                          {t('profile.email.label')}
                        </div>
                        <div className="font-medium">{user.email}</div>
                      </div>
                    </div>

                    <div className="divider my-1" />

                    <div className="flex items-center gap-3">
                      {user.email_verified ? (
                        <CheckCircleIcon
                          size={24}
                          weight="regular"
                          className="text-success"
                        />
                      ) : (
                        <XCircleIcon
                          size={24}
                          weight="regular"
                          className="text-error"
                        />
                      )}
                      <div className="flex-1">
                        <div className="text-base-content/60 text-sm">
                          {t('profile.verified.label')}
                        </div>
                        <div
                          className={`font-medium ${
                            user.email_verified ? 'text-success' : 'text-error'
                          }`}
                        >
                          {user.email_verified
                            ? t('profile.verified.yes')
                            : t('profile.verified.no')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Linked OAuth Accounts */}
            {availableProviders.length > 0 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="font-semibold text-lg">
                    {t('profile.linkedAccounts.title')}
                  </h2>
                  <p className="text-base-content/70 text-sm">
                    {t('profile.linkedAccounts.description')}
                  </p>
                </div>
                <div className="card bg-base-200">
                  <div className="card-body gap-3 p-4">
                    {availableProviders.map((provider) => (
                      <div
                        key={provider.name}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <LinkIcon
                            size={20}
                            weight="regular"
                            className={
                              provider.linked
                                ? 'text-success'
                                : 'text-base-content/50'
                            }
                          />
                          <span className="font-medium">
                            {provider.display_name}
                          </span>
                        </div>
                        {provider.linked ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-error"
                            disabled={unlinkingProvider === provider.name}
                            onClick={() => handleUnlink(provider.name)}
                          >
                            {unlinkingProvider === provider.name ? (
                              <>
                                <span className="loading loading-spinner loading-xs" />
                                {t('profile.linkedAccounts.unlinking')}
                              </>
                            ) : (
                              t('profile.linkedAccounts.unlink')
                            )}
                          </button>
                        ) : (
                          <a
                            href={getOAuthConnectUrl(
                              provider.name,
                              'link',
                              '/profile',
                            )}
                            className="btn btn-ghost btn-sm text-primary"
                          >
                            {t('profile.linkedAccounts.link')}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn btn-outline btn-error w-full"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              {logoutMutation.isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  {t('profile.logout')}
                </>
              ) : (
                t('profile.logout')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
