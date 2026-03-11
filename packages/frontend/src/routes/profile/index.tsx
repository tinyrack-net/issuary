import { SignOutIcon, WarningCircleIcon } from '@phosphor-icons/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DangerZoneSection } from '#frontend/components/profile/danger-zone-section.js';
import { LinkedAccountsSection } from '#frontend/components/profile/linked-accounts-section.js';
import { PasskeySection } from '#frontend/components/profile/passkey-section.js';
import { PasswordSection } from '#frontend/components/profile/password-section.js';
import { TotpSection } from '#frontend/components/profile/totp-section.js';
import { UnlinkOAuthModal } from '#frontend/components/profile/unlink-oauth-modal.js';
import { UserInfoSection } from '#frontend/components/profile/user-info-section.js';
import { Alert } from '#frontend/components/ui/alert.js';
import { InitialAvatar } from '#frontend/components/ui/initial-avatar.js';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.js';
import { PageLayout } from '#frontend/features/layout/page-layout.js';
import { ChangePasswordModal } from '#frontend/features/profile/change-password-modal.js';
import { DeleteAccountModal } from '#frontend/features/profile/delete-account-modal.js';
import { DisableTotpModal } from '#frontend/features/profile/disable-totp-modal.js';
import { ManagePasskeysModal } from '#frontend/features/profile/manage-passkeys-modal.js';
import { RegenerateTotpRecoveryCodesModal } from '#frontend/features/profile/regenerate-totp-recovery-codes-modal.js';
import { RemovePasswordModal } from '#frontend/features/profile/remove-password-modal.js';
import { SetPasswordModal } from '#frontend/features/profile/set-password-modal.js';
import { SetupPasskeyModal } from '#frontend/features/profile/setup-passkey-modal.js';
import { SetupTotpModal } from '#frontend/features/profile/setup-totp-modal.js';
import { tick } from '#frontend/libs/promise.js';
import { appConfigQueryOptions } from '#frontend/queries/config.js';
import { logoutMutationOptions } from '#frontend/queries/logout.js';
import {
  getOAuthAuthorizeUrl,
  oauthAccountsQueryOptions,
  unlinkOAuthMutationOptions,
} from '#frontend/queries/oauth.js';
import { getSessionQueryOptions } from '#frontend/queries/session.js';

type PasswordModalType = 'set' | 'change' | 'remove' | null;
type TotpModalType = 'setup' | 'disable' | 'regenerate' | null;
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

function ProfileError(props: ErrorComponentProps) {
  return (
    <RouteErrorFallback
      {...props}
      onUnauthorized={() => {
        window.location.href = '/login';
      }}
    />
  );
}

export const Route = createFileRoute('/profile/')({
  component: Profile,
  errorComponent: ProfileError,
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
  const [unlinkModal, setUnlinkModal] = useState<{
    id: string;
    name: string;
  } | null>(null);
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

  const handleUnlinkConfirm = async () => {
    if (!unlinkModal) return;
    setUnlinkingProvider(unlinkModal.id);
    await unlinkMutation.mutateAsync(unlinkModal.id);
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
  const passwordAuthMethod = appConfig.auth.password;
  const passkeyAuthMethod = appConfig.auth.passkey;
  const totpEnabled = passwordAuthMethod.totp.enabled;
  const passkeyEnabled = passkeyAuthMethod.enabled;

  // Account deletion settings
  const accountDeletionEnabled = appConfig.account_deletion.enabled;
  const retentionPeriod = appConfig.account_deletion.retention;

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
    <PageLayout maxWidth="xl" responsivePadding>
      {/* Header */}
      <div className="border-base-200 border-b p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <InitialAvatar email={user.email} size="lg" />
            <div className="min-w-0">
              <h1 className="font-bold text-xl">{t('profile.title')}</h1>
              <p
                className="truncate text-base-content/70 text-sm"
                data-testid="profile-user-email"
              >
                {user.email}
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm gap-2"
            data-testid="profile-logout"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
            type="button"
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
        <div className="px-6 pt-4">
          <Alert icon={WarningCircleIcon} type="error">
            {oauthErrorMessage}
          </Alert>
        </div>
      )}

      {/* Content - Single Column */}
      <div className="space-y-5 p-6">
        {/* Account Information */}
        {user && <UserInfoSection user={user} />}

        {/* Security Options */}
        {hasSecurityOptions && (
          <div className="rounded-xl border border-base-200">
            <div className="border-base-200 border-b px-4 py-3">
              <h2 className="font-semibold text-sm">
                {t('profile.security.title')}
              </h2>
              <p className="text-base-content/60 text-xs">
                {t('profile.security.description')}
              </p>
            </div>
            {showTotpSection && user.totp_recovery_codes_missing && (
              <div
                className="border-base-200 border-b px-4 py-3"
                data-testid="profile-totp-recovery-warning"
              >
                <Alert icon={WarningCircleIcon} type="warning">
                  {t('profile.totp.recoveryCodesMissing')}
                </Alert>
              </div>
            )}
            <div className="divide-y divide-base-200">
              {showPasswordSection && (
                <PasswordSection
                  hasLinkedOAuth={hasLinkedOAuth}
                  hasPassword={user.has_password}
                  hasSecondFactorOnly={
                    user.has_password &&
                    !hasLinkedOAuth &&
                    (user.totp_registered || user.passkey_count > 0)
                  }
                  isConfigManaged={isConfigManaged}
                  onOpenModal={setPasswordModal}
                />
              )}
              {showTotpSection && (
                <TotpSection
                  onOpenModal={setTotpModal}
                  recoveryCodesMissing={user.totp_recovery_codes_missing}
                  totpEnabled={user.totp_registered}
                />
              )}
              {showPasskeySection && (
                <PasskeySection
                  onOpenModal={setPasskeyModal}
                  passkeyCount={user.passkey_count}
                />
              )}
            </div>
          </div>
        )}

        {/* Linked OAuth Accounts */}
        {showLinkedAccounts && (
          <LinkedAccountsSection
            getAuthorizeUrl={getOAuthAuthorizeUrl}
            onUnlinkRequest={(provider) =>
              setUnlinkModal({
                id: provider.id,
                name: provider.display_name,
              })
            }
            providers={availableProviders}
            unlinkingProvider={unlinkingProvider}
          />
        )}

        {/* Danger Zone */}
        <DangerZoneSection
          isConfigManaged={isConfigManaged}
          isDeletionEnabled={accountDeletionEnabled}
          onDeleteClick={() => setShowDeleteModal(true)}
        />
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
      <RegenerateTotpRecoveryCodesModal
        isOpen={totpModal === 'regenerate'}
        onClose={() => setTotpModal(null)}
      />

      {/* Passkey Modals */}
      <SetupPasskeyModal
        isOpen={passkeyModal === 'setup'}
        onClose={() => setPasskeyModal(null)}
      />
      <ManagePasskeysModal
        isOpen={passkeyModal === 'manage'}
        onAddNew={() => setPasskeyModal('setup')}
        onClose={() => setPasskeyModal(null)}
      />

      {/* Unlink OAuth Modal */}
      <UnlinkOAuthModal
        isOpen={unlinkModal !== null}
        isPending={unlinkMutation.isPending}
        onClose={() => setUnlinkModal(null)}
        onConfirm={handleUnlinkConfirm}
        providerName={unlinkModal?.name ?? ''}
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
