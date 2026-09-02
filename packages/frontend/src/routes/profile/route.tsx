import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRText } from '@tinyrack/ui/components/text';
import { CircleAlertIcon, LogOutIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { redirect, useNavigate } from 'react-router';
import { z } from 'zod';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { DangerZoneSection } from '#frontend/components/profile/danger-zone-section.tsx';
import { LinkedAccountsSection } from '#frontend/components/profile/linked-accounts-section.tsx';
import { PasskeySection } from '#frontend/components/profile/passkey-section.tsx';
import { PasswordSection } from '#frontend/components/profile/password-section.tsx';
import { TotpSection } from '#frontend/components/profile/totp-section.tsx';
import { UnlinkOAuthModal } from '#frontend/components/profile/unlink-oauth-modal.tsx';
import { UserInfoSection } from '#frontend/components/profile/user-info-section.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { InitialAvatar } from '#frontend/components/ui/initial-avatar.tsx';
import { RouteErrorFallback } from '#frontend/components/ui/route-error-fallback.tsx';
import { AppLayout } from '#frontend/features/layout/app-layout.tsx';
import { ChangePasswordModal } from '#frontend/features/profile/change-password-modal.tsx';
import { DeleteAccountModal } from '#frontend/features/profile/delete-account-modal.tsx';
import { DisableTotpModal } from '#frontend/features/profile/disable-totp-modal.tsx';
import { ManagePasskeysModal } from '#frontend/features/profile/manage-passkeys-modal.tsx';
import { RegenerateTotpRecoveryCodesModal } from '#frontend/features/profile/regenerate-totp-recovery-codes-modal.tsx';
import { RemovePasswordModal } from '#frontend/features/profile/remove-password-modal.tsx';
import { SetPasswordModal } from '#frontend/features/profile/set-password-modal.tsx';
import { SetupPasskeyModal } from '#frontend/features/profile/setup-passkey-modal.tsx';
import { SetupTotpModal } from '#frontend/features/profile/setup-totp-modal.tsx';
import { navigateDocument } from '#frontend/libs/document-navigation.ts';
import { tick } from '#frontend/libs/promise.ts';
import {
  createRouteLoaderData,
  NativeRouteErrorBoundary,
  parseRequestSearch,
  type RouteErrorComponentProps,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { logoutMutationOptions } from '#frontend/queries/logout.ts';
import {
  createOAuthAccountsQueryOptions,
  getOAuthAuthorizeUrl,
  oauthAccountsQueryOptions,
  unlinkOAuthMutationOptions,
} from '#frontend/queries/oauth.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import type { Route } from './+types/route.js';

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

function ProfileError(props: RouteErrorComponentProps) {
  return (
    <RouteErrorFallback
      {...props}
      onUnauthorized={() => {
        navigateDocument('/login');
      }}
    />
  );
}

function Profile({ search }: { search: z.infer<typeof SearchSchema> }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      navigate('/login');
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

  if (!session.user) {
    return null;
  }

  const user = session.user;
  const availableProviders = oauthAccountsData.available_providers;
  const hasLinkedOAuth = availableProviders.some((p) => p.linked);
  const isConfigManaged = user.managed_by === 'config';

  const passwordAuthMethod = appConfig.auth.password;
  const passkeyAuthMethod = appConfig.auth.passkey;
  const totpEnabled = passwordAuthMethod.totp.enabled;
  const passkeyEnabled = passkeyAuthMethod.enabled;

  const accountDeletionEnabled = appConfig.account_deletion.enabled;
  const retentionPeriod = appConfig.account_deletion.retention;

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

  const showPasswordSection = true;
  const showTotpSection = !isConfigManaged && totpEnabled;
  const showPasskeySection = !isConfigManaged && passkeyEnabled;
  const showLinkedAccounts = availableProviders.length > 0;
  const hasSecurityOptions =
    showPasswordSection || showTotpSection || showPasskeySection;

  return (
    <AppLayout
      headerActions={
        <TRButton
          appearance="ghost"
          /*
            The visible label collapses below `sm:`, which would leave the
            control unnamed on a phone. `profile.logout` is the same string
            the label renders, so this does not shadow it.
          */
          aria-label={t('profile.logout')}
          data-testid="profile-logout"
          disabled={logoutMutation.isPending}
          loading={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
          type="button"
          uiSize="sm"
        >
          {logoutMutation.isPending ? undefined : (
            <>
              <LogOutIcon aria-hidden className="size-tinyrack-lg" />
              <TRText as="span" className="hidden sm:inline" variant="bodySm">
                {t('profile.logout')}
              </TRText>
            </>
          )}
        </TRButton>
      }
    >
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural profile identity row; descendants own visible typography. */}
      <div className="flex items-center gap-tinyrack-lg">
        <InitialAvatar email={user.email} size="lg" />
        {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural profile heading group; descendants own visible typography. */}
        <div className="flex min-w-0 flex-col gap-tinyrack-3xs">
          <AuthPageHeader title={t('profile.title')} />
          {/*
            Rendered here rather than as the header's `subtitle`: this node
            carries a testid and needs to truncate, neither of which the
            shared header does, and growing its API for one non-auth caller
            would be the wrong trade.
          */}
          <TRText
            as="p"
            color="muted"
            data-testid="profile-user-email"
            truncate
            variant="bodySm"
          >
            {user.email}
          </TRText>
        </div>
      </div>

      {oauthErrorMessage && (
        <Alert icon={CircleAlertIcon} type="error">
          {oauthErrorMessage}
        </Alert>
      )}

      {user && <UserInfoSection user={user} />}

      {hasSecurityOptions && (
        <TRCard.Root variant="outlined">
          <TRCard.Header className="border-tinyrack-border border-b-tinyrack-default px-tinyrack-lg py-tinyrack-md">
            <TRCard.Title>{t('profile.security.title')}</TRCard.Title>
            <TRCard.Description>
              {t('profile.security.description')}
            </TRCard.Description>
          </TRCard.Header>
          {showTotpSection && user.totp_recovery_codes_missing && (
            <div
              className="border-tinyrack-border border-b-tinyrack-default px-tinyrack-lg py-tinyrack-md"
              data-testid="profile-totp-recovery-warning"
            >
              <Alert icon={CircleAlertIcon} type="warning">
                {t('profile.totp.recoveryCodesMissing')}
              </Alert>
            </div>
          )}
          <TRCard.Content className="divide-y divide-tinyrack-border p-0">
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
          </TRCard.Content>
        </TRCard.Root>
      )}

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

      <DangerZoneSection
        isConfigManaged={isConfigManaged}
        isDeletionEnabled={accountDeletionEnabled}
        onDeleteClick={() => setShowDeleteModal(true)}
      />

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

      <SetupPasskeyModal
        isOpen={passkeyModal === 'setup'}
        onClose={() => setPasskeyModal(null)}
      />
      <ManagePasskeysModal
        isOpen={passkeyModal === 'manage'}
        onAddNew={() => setPasskeyModal('setup')}
        onClose={() => setPasskeyModal(null)}
      />

      <UnlinkOAuthModal
        isOpen={unlinkModal !== null}
        isPending={unlinkMutation.isPending}
        onClose={() => setUnlinkModal(null)}
        onConfirm={handleUnlinkConfirm}
        providerName={unlinkModal?.name ?? ''}
      />

      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        retentionDays={retentionDays}
      />
    </AppLayout>
  );
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  if (!runtime.session.user) throw redirect('/login');
  await runtime.queryClient.ensureQueryData(
    createOAuthAccountsQueryOptions(runtime.api),
  );
  return createRouteLoaderData(
    runtime.queryClient,
    parseRequestSearch(request, SearchSchema),
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <NativeRouteErrorBoundary component={ProfileError} error={error} />;
}

export default function ProfileRoute({ loaderData }: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <Profile search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}
