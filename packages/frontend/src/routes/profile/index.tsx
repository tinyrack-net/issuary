import {
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  KeyIcon,
  LinkIcon,
  SignOutIcon,
  UserIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { tick } from '@/libs/promise';
import { ChangePasswordModal } from '@/modals/profile/change-password-modal.js';
import { RemovePasswordModal } from '@/modals/profile/remove-password-modal.js';
import { SetPasswordModal } from '@/modals/profile/set-password-modal.js';
import { logoutMutationOptions } from '@/queries/logout';
import {
  getOAuthConnectUrl,
  oauthAccountsQueryOptions,
  unlinkOAuthMutationOptions,
} from '@/queries/oauth';
import { getSessionQueryOptions } from '@/queries/session';

type PasswordModalType = 'set' | 'change' | 'remove' | null;

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
  const [passwordModal, setPasswordModal] = useState<PasswordModalType>(null);

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
  const hasLinkedOAuth = availableProviders.some((p) => p.linked);

  return (
    <AuthPageLayout>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      {/* User Info Card */}
      {user && (
        <div className="mb-4 rounded-lg bg-base-200 p-4">
          <div className="flex flex-col gap-3">
            {/* User ID */}
            <div className="flex items-center gap-3">
              <UserIcon className="size-5 text-primary" weight="regular" />
              <div className="flex-1">
                <div className="text-base-content/60 text-xs">
                  {t('profile.id.label')}
                </div>
                <div className="truncate font-medium text-sm">{user.id}</div>
              </div>
            </div>

            <div className="h-px bg-base-300" />

            {/* Email */}
            <div className="flex items-center gap-3">
              <EnvelopeSimpleIcon
                className="size-5 text-primary"
                weight="regular"
              />
              <div className="flex-1">
                <div className="text-base-content/60 text-xs">
                  {t('profile.email.label')}
                </div>
                <div className="font-medium text-sm">{user.email}</div>
              </div>
            </div>

            <div className="h-px bg-base-300" />

            {/* Email Verified */}
            <div className="flex items-center gap-3">
              {user.email_verified ? (
                <CheckCircleIcon className="size-5 text-success" weight="regular" />
              ) : (
                <XCircleIcon className="size-5 text-error" weight="regular" />
              )}
              <div className="flex-1">
                <div className="text-base-content/60 text-xs">
                  {t('profile.verified.label')}
                </div>
                <div
                  className={`font-medium text-sm ${
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
      )}

      {/* Password Management */}
      {user && (
        <div className="mb-4">
          <h2 className="mb-2 font-semibold text-sm">
            {t('profile.password.title')}
          </h2>
          <p className="mb-3 text-base-content/60 text-xs">
            {t('profile.password.description')}
          </p>
          <div className="rounded-lg bg-base-200 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyIcon
                  className={`size-4 ${
                    user.has_password ? 'text-success' : 'text-base-content/50'
                  }`}
                  weight="regular"
                />
                <span className="text-sm">
                  {user.has_password
                    ? t('profile.password.status.set')
                    : t('profile.password.status.notSet')}
                </span>
              </div>
              <div className="flex gap-1">
                {user.has_password ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-primary"
                      onClick={() => setPasswordModal('change')}
                    >
                      {t('profile.password.change')}
                    </button>
                    {hasLinkedOAuth && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => setPasswordModal('remove')}
                      >
                        {t('profile.password.remove')}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-primary"
                    onClick={() => setPasswordModal('set')}
                  >
                    {t('profile.password.set')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Linked OAuth Accounts */}
      {availableProviders.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-2 font-semibold text-sm">
            {t('profile.linkedAccounts.title')}
          </h2>
          <p className="mb-3 text-base-content/60 text-xs">
            {t('profile.linkedAccounts.description')}
          </p>
          <div className="rounded-lg bg-base-200 p-3">
            <div className="flex flex-col gap-2">
              {availableProviders.map((provider) => (
                <div
                  key={provider.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <LinkIcon
                      className={`size-4 ${
                        provider.linked
                          ? 'text-success'
                          : 'text-base-content/50'
                      }`}
                      weight="regular"
                    />
                    <span className="font-medium text-sm">
                      {provider.display_name}
                    </span>
                  </div>
                  {provider.linked ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
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
                      className="btn btn-ghost btn-xs text-primary"
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

      {/* Logout Button */}
      <button
        type="button"
        className="btn btn-block h-10 font-semibold text-[14px]"
        disabled={logoutMutation.isPending}
        onClick={() => logoutMutation.mutate()}
      >
        {logoutMutation.isPending ? (
          <>
            <span className="loading loading-spinner loading-sm" />
            {t('profile.logout')}
          </>
        ) : (
          <>
            <SignOutIcon className="size-4" weight="bold" />
            {t('profile.logout')}
          </>
        )}
      </button>

      {/* Password Modals */}
      <SetPasswordModal
        isOpen={passwordModal === 'set'}
        onClose={() => setPasswordModal(null)}
      />
      <ChangePasswordModal
        isOpen={passwordModal === 'change'}
        onClose={() => setPasswordModal(null)}
      />
      <RemovePasswordModal
        isOpen={passwordModal === 'remove'}
        onClose={() => setPasswordModal(null)}
      />
    </AuthPageLayout>
  );
}
