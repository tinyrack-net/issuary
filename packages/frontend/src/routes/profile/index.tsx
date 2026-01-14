import { SignOutIcon, UserCircleIcon } from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { ProfilePageLayout } from '@/components/profile/profile-page-layout.js';
import { TotpSection } from '@/components/profile/totp-section.js';
import { UserInfoSection } from '@/components/profile/user-info-section.js';
import { tick } from '@/libs/promise';
import { appConfigQueryOptions } from '@/queries/config';
import { logoutMutationOptions } from '@/queries/logout';
import {
  getOAuthConnectUrl,
  oauthAccountsQueryOptions,
  unlinkOAuthMutationOptions,
} from '@/queries/oauth';
import { getSessionQueryOptions } from '@/queries/session';

type PasswordModalType = 'set' | 'change' | 'remove' | null;
type TotpModalType = 'setup' | 'disable' | null;
type PasskeyModalType = 'setup' | 'manage' | null;

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

  const user = session.user;
  const availableProviders = oauthAccountsData.available_providers;
  const hasLinkedOAuth = availableProviders.some((p) => p.linked);
  const isConfigManaged = user?.managed === 'config';

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

  // Check if user needs to set up TOTP or Passkey (required settings)
  const needsTotpSetup = user?.totp_required ?? false;

  // Auto-open required setup modals
  useEffect(() => {
    if (needsTotpSetup) {
      // TOTP required
      if (!totpModal) {
        setTotpModal('setup');
      }
    }
  }, [needsTotpSetup, totpModal]);

  // Handle modal close with required check
  const handleCloseTotpModal = () => {
    if (!needsTotpSetup) {
      // Only close if not required
      setTotpModal(null);
    }
    // If TOTP is required, prevent closing
  };

  const handleClosePasskeyModal = () => {
    setPasskeyModal(null);
  };

  // Determine which security sections to show
  const showPasswordSection = user !== null;
  const showTotpSection = user && !isConfigManaged && totpEnabled;
  const showPasskeySection = user && !isConfigManaged && passkeyEnabled;
  const showLinkedAccounts = availableProviders.length > 0;
  const hasSecurityOptions =
    showPasswordSection || showTotpSection || showPasskeySection;

  return (
    <ProfilePageLayout>
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
                      totpEnabled={user.totp_enabled}
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
        onClose={handleCloseTotpModal}
        isRequired={needsTotpSetup}
      />
      <DisableTotpModal
        isOpen={totpModal === 'disable'}
        onClose={() => setTotpModal(null)}
      />

      {/* Passkey Modals */}
      <SetupPasskeyModal
        isOpen={passkeyModal === 'setup'}
        onClose={handleClosePasskeyModal}
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
    </ProfilePageLayout>
  );
}
