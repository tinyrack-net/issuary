import {
  SignOutIcon,
  UserCircleIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { ChangePasswordModal } from '@/components/modals/profile/change-password-modal.js';
import { DeleteAccountModal } from '@/components/modals/profile/delete-account-modal.js';
import { DisableTotpModal } from '@/components/modals/profile/disable-totp-modal.js';
import { ManagePasskeysModal } from '@/components/modals/profile/manage-passkeys-modal.js';
import { RemovePasswordModal } from '@/components/modals/profile/remove-password-modal.js';
import { SetPasswordModal } from '@/components/modals/profile/set-password-modal.js';
import { SetupPasskeyModal } from '@/components/modals/profile/setup-passkey-modal.js';
import { SetupTotpModal } from '@/components/modals/profile/setup-totp-modal.js';
import { DangerZoneSection } from '@/components/profile/danger-zone-section.js';
import { LinkedAccountsSection } from '@/components/profile/linked-accounts-section.js';
import { PasskeySection } from '@/components/profile/passkey-section.js';
import { PasswordSection } from '@/components/profile/password-section.js';
import { TotpSection } from '@/components/profile/totp-section.js';
import { UserInfoSection } from '@/components/profile/user-info-section.js';
import { Alert } from '@/components/ui/alert.js';
import { PageLayout } from '@/components/ui/page-layout.js';
import { tick } from '@/libs/promise.js';
import { appConfigQueryOptions } from '@/queries/config.js';
import { logoutMutationOptions } from '@/queries/logout.js';
import {
  getOAuthConnectUrl,
  oauthAccountsQueryOptions,
  unlinkOAuthMutationOptions,
} from '@/queries/oauth.js';
import { getSessionQueryOptions } from '@/queries/session.js';

type PasswordModalType = 'set' | 'change' | 'remove' | null;
type TotpModalType = 'setup' | 'disable' | null;
type PasskeyModalType = 'setup' | 'manage' | null;

const SearchSchema = z.object({
  oauth_error: z.string().optional(),
  oauth_error_description: z.string().optional(),
});

const OAUTH_ERROR_I18N_MAP: Record<string, string> = {
  access_denied: 'oauth.error.accessDenied',
  temporarily_unavailable: 'oauth.error.temporarilyUnavailable',
  server_error: 'oauth.error.serverError',
};

export const Route = createFileRoute('/profile/')({
  component: Profile,
  validateSearch: SearchSchema,
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({
        to: '/login',
      });
    }
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(getSessionQueryOptions),
      context.queryClient.ensureQueryData(oauthAccountsQueryOptions),
      context.queryClient.ensureQueryData(appConfigQueryOptions),
    ]);
  },
});

function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const oauthError = search.oauth_error;
  const oauthErrorMessage = oauthError
    ? t(OAUTH_ERROR_I18N_MAP[oauthError] ?? 'oauth.error.failed')
    : undefined;
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(
    null,
  );
  const [passwordModal, setPasswordModal] = useState<PasswordModalType>(null);
  const [totpModal, setTotpModal] = useState<TotpModalType>(null);
  const [passkeyModal, setPasskeyModal] = useState<PasskeyModalType>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: session } = useSuspenseQuery(getSessionQueryOptions);
  const { data: oauthAccountsData } = useSuspenseQuery(
    oauthAccountsQueryOptions,
  );
  const { data: appConfig } = useSuspenseQuery(appConfigQueryOptions);

  const logoutMutation = useMutation({
    ...logoutMutationOptions,
    onSuccess: async () => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: undefined,
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

  const handleUnlink = async (providerId: string) => {
    if (
      !window.confirm(
        t('profile.linkedAccounts.unlinkConfirm', { provider: providerId }),
      )
    ) {
      return;
    }
    setUnlinkingProvider(providerId);
    try {
      await unlinkMutation.mutateAsync(providerId);
    } catch {
      alert(t('profile.linkedAccounts.unlinkError'));
    }
  };

  // Handle non-authenticated states (should be redirected, but fallback)
  if (!session.user) {
    return null;
  }

  const user = session.user;
  const availableProviders = oauthAccountsData.available_providers;
  const hasLinkedOAuth = availableProviders.some((p) => p.linked);
  const isConfigManaged = user.managed_by === 'config';

  // Check if TOTP and Passkey are enabled in config
  const passwordAuthMethod = appConfig.basic_authentication_methods.password;
  const passkeyAuthMethod = appConfig.basic_authentication_methods.passkey;
  const totpEnabled = passwordAuthMethod.totp.enabled;
  const passkeyEnabled = passkeyAuthMethod.enabled;

  // Account deletion settings
  const accountDeletionEnabled = appConfig.account_deletion.enabled;
  const retentionPeriod = appConfig.account_deletion.retention_period;

  // Parse retention period to get days for display
  const retentionDays = (() => {
    const match = retentionPeriod.match(/^(\d+)([dmy])$/);
    if (!match) return 30;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 'd':
        return value;
      case 'm':
        return value * 30;
      case 'y':
        return value * 365;
      default:
        return 30;
    }
  })();

  // Determine which security sections to show
  const showPasswordSection = true;
  const showTotpSection = !isConfigManaged && totpEnabled;
  const showPasskeySection = !isConfigManaged && passkeyEnabled;
  const showLinkedAccounts = availableProviders.length > 0;
  const hasSecurityOptions =
    showPasswordSection || showTotpSection || showPasskeySection;

  return (
    <PageLayout maxWidth="2xl" responsivePadding>
      {/* Header */}
      <div className="border-base-200 border-b bg-base-100 p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <UserCircleIcon
                className="size-8 text-primary"
                weight="regular"
              />
            </div>
            <div>
              <h1 className="font-bold text-xl">{t('profile.title')}</h1>
              <p className="text-base-content/60 text-sm">
                {t('profile.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-2"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            {logoutMutation.isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <SignOutIcon className="size-4" weight="bold" />
            )}
            <span className="hidden sm:inline">{t('profile.logout')}</span>
          </button>
        </div>
      </div>

      {/* OAuth Error Alert */}
      {oauthErrorMessage && (
        <div className="px-6 pt-4 md:px-8">
          <Alert type="error" icon={WarningCircleIcon}>
            {oauthErrorMessage}
          </Alert>
        </div>
      )}

      {/* Content */}
      <div className="p-6 md:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column - Account Info */}
          <div className="space-y-6">
            {/* User Info Card */}
            {user && <UserInfoSection user={user} />}
          </div>

          {/* Right Column - Security & Connections */}
          <div className="space-y-6">
            {/* Security Options */}
            {hasSecurityOptions && (
              <div className="rounded-xl border border-base-200 bg-base-100">
                <div className="border-base-200 border-b p-4">
                  <h2 className="font-semibold">
                    {t('profile.security.title')}
                  </h2>
                  <p className="text-base-content/60 text-sm">
                    {t('profile.security.description')}
                  </p>
                </div>
                <div className="divide-y divide-base-200">
                  {/* Password */}
                  {showPasswordSection && (
                    <PasswordSection
                      hasPassword={user.has_password}
                      hasLinkedOAuth={hasLinkedOAuth}
                      isConfigManaged={isConfigManaged}
                      onOpenModal={setPasswordModal}
                    />
                  )}

                  {/* TOTP */}
                  {showTotpSection && (
                    <TotpSection
                      totpEnabled={user.totp_registered}
                      onOpenModal={setTotpModal}
                    />
                  )}

                  {/* Passkey */}
                  {showPasskeySection && (
                    <PasskeySection
                      passkeyCount={user.passkey_count}
                      onOpenModal={setPasskeyModal}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Linked OAuth Accounts */}
            {showLinkedAccounts && (
              <LinkedAccountsSection
                providers={availableProviders}
                unlinkingProvider={unlinkingProvider}
                getConnectUrl={getOAuthConnectUrl}
                onUnlink={handleUnlink}
              />
            )}

            {/* Danger Zone - Account Deletion */}
            <DangerZoneSection
              isConfigManaged={isConfigManaged}
              isDeletionEnabled={accountDeletionEnabled}
              onDeleteClick={() => setShowDeleteModal(true)}
            />
          </div>
        </div>
      </div>

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

      {/* TOTP Modals */}
      <SetupTotpModal
        isOpen={totpModal === 'setup'}
        onClose={() => setTotpModal(null)}
      />
      <DisableTotpModal
        isOpen={totpModal === 'disable'}
        onClose={() => setTotpModal(null)}
      />

      {/* Passkey Modals */}
      <SetupPasskeyModal
        isOpen={passkeyModal === 'setup'}
        onClose={() => setPasskeyModal(null)}
      />
      <ManagePasskeysModal
        isOpen={passkeyModal === 'manage'}
        onClose={() => setPasskeyModal(null)}
        onAddNew={() => setPasskeyModal('setup')}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        retentionDays={retentionDays}
      />
    </PageLayout>
  );
}
