import { SignOutIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { ChangePasswordModal } from '@/components/modals/profile/change-password-modal.js';
import { DisableTotpModal } from '@/components/modals/profile/disable-totp-modal.js';
import { ManagePasskeysModal } from '@/components/modals/profile/manage-passkeys-modal.js';
import { RemovePasswordModal } from '@/components/modals/profile/remove-password-modal.js';
import { SetPasswordModal } from '@/components/modals/profile/set-password-modal.js';
import { SetupPasskeyModal } from '@/components/modals/profile/setup-passkey-modal.js';
import { SetupTotpModal } from '@/components/modals/profile/setup-totp-modal.js';
import { LinkedAccountsSection } from '@/components/profile/linked-accounts-section.js';
import { PasskeySection } from '@/components/profile/passkey-section.js';
import { PasswordSection } from '@/components/profile/password-section.js';
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

  const { data: session } = useQuery(getSessionQueryOptions);
  const { data: oauthAccountsData } = useQuery(oauthAccountsQueryOptions);
  const { data: appConfig } = useQuery(appConfigQueryOptions);

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
  const isConfigManaged = user?.managed === 'config';

  // Check if TOTP and Passkey are enabled in config
  const passwordAuthMethod = appConfig?.authentication_methods?.password;
  const totpEnabled = passwordAuthMethod?.totp?.enabled ?? false;
  const passkeyEnabled = passwordAuthMethod?.passkey?.enabled ?? false;

  // Check if user needs to set up TOTP or Passkey (required settings)
  const needsTotpSetup = user?.totp_required ?? false;
  const needsPasskeySetup = user?.passkey_required ?? false;

  // Auto-open required setup modals
  useEffect(() => {
    // Only check required setup if config is loaded
    if (!appConfig) return;

    // TOTP and Passkey both required: user can choose either (OR logic)
    if (needsTotpSetup && needsPasskeySetup) {
      // Open TOTP modal as the default, user can switch to Passkey if they prefer
      if (!totpModal && !passkeyModal) {
        setTotpModal('setup');
      }
    } else if (needsTotpSetup) {
      // Only TOTP required
      if (!totpModal) {
        setTotpModal('setup');
      }
    } else if (needsPasskeySetup) {
      // Only Passkey required
      if (!passkeyModal) {
        setPasskeyModal('setup');
      }
    }
  }, [appConfig, needsTotpSetup, needsPasskeySetup, totpModal, passkeyModal]);

  // Handle modal close with required check
  const handleCloseTotpModal = () => {
    // If both are required (OR logic), allow switching to Passkey
    if (needsTotpSetup && needsPasskeySetup && passkeyEnabled) {
      setTotpModal(null);
      setPasskeyModal('setup');
    } else if (!needsTotpSetup) {
      // Only close if not required
      setTotpModal(null);
    }
    // If only TOTP is required, prevent closing
  };

  const handleClosePasskeyModal = () => {
    // If both are required (OR logic), allow switching to TOTP
    if (needsTotpSetup && needsPasskeySetup && totpEnabled) {
      setPasskeyModal(null);
      setTotpModal('setup');
    } else if (!needsPasskeySetup) {
      // Only close if not required
      setPasskeyModal(null);
    }
    // If only Passkey is required, prevent closing
  };

  return (
    <AuthPageLayout>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      {/* User Info Card */}
      {user && <UserInfoSection user={user} />}

      {/* Password Management */}
      {user && (
        <PasswordSection
          hasPassword={user.has_password}
          hasLinkedOAuth={hasLinkedOAuth}
          isConfigManaged={isConfigManaged}
          onOpenModal={setPasswordModal}
        />
      )}

      {/* Two-Factor Authentication */}
      {user && !isConfigManaged && totpEnabled && (
        <TotpSection
          totpEnabled={user.totp_enabled}
          onOpenModal={setTotpModal}
        />
      )}

      {/* Passkey Authentication */}
      {user && !isConfigManaged && passkeyEnabled && (
        <PasskeySection
          passkeyCount={user.passkey_count}
          onOpenModal={setPasskeyModal}
        />
      )}

      {/* Linked OAuth Accounts */}
      <LinkedAccountsSection
        providers={availableProviders}
        unlinkingProvider={unlinkingProvider}
        getConnectUrl={getOAuthConnectUrl}
        onUnlink={handleUnlink}
      />

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

      {/* TOTP Modals */}
      <SetupTotpModal
        isOpen={totpModal === 'setup'}
        onClose={handleCloseTotpModal}
        isRequired={needsTotpSetup}
        canSwitchToPasskey={needsPasskeySetup && passkeyEnabled}
        onSwitchToPasskey={() => {
          setTotpModal(null);
          setPasskeyModal('setup');
        }}
      />
      <DisableTotpModal
        isOpen={totpModal === 'disable'}
        onClose={() => setTotpModal(null)}
      />

      {/* Passkey Modals */}
      <SetupPasskeyModal
        isOpen={passkeyModal === 'setup'}
        onClose={handleClosePasskeyModal}
        isRequired={needsPasskeySetup}
        canSwitchToTotp={needsTotpSetup && totpEnabled}
        onSwitchToTotp={() => {
          setPasskeyModal(null);
          setTotpModal('setup');
        }}
      />
      <ManagePasskeysModal
        isOpen={passkeyModal === 'manage'}
        onClose={() => setPasskeyModal(null)}
        onAddNew={() => setPasskeyModal('setup')}
      />
    </AuthPageLayout>
  );
}
