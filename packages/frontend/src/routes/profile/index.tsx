import {
  CheckCircle,
  EnvelopeSimple,
  Key,
  Link as LinkIcon,
  SignOut,
  User,
  XCircle,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { AuthPageLayout, PageHeader } from '@/components/auth/index.js';
import { tick } from '@/libs/promise';
import { logoutMutationOptions } from '@/queries/logout';
import {
  getOAuthConnectUrl,
  oauthAccountsQueryOptions,
  unlinkOAuthMutationOptions,
} from '@/queries/oauth';
import {
  changePasswordMutationOptions,
  removePasswordMutationOptions,
  setPasswordMutationOptions,
} from '@/queries/password';
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

  // Password form schemas
  const setPasswordSchema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(6, t('validation.password.min'))
            .max(100, t('validation.password.max')),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('validation.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  );

  const changePasswordSchema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t('validation.password.required')),
          newPassword: z
            .string()
            .min(6, t('validation.password.min'))
            .max(100, t('validation.password.max')),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t('validation.confirmPassword.mismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  );

  const removePasswordSchema = useMemo(
    () =>
      z.object({
        currentPassword: z.string().min(1, t('validation.password.required')),
      }),
    [t],
  );

  // Forms
  const setPasswordForm = useForm({
    resolver: standardSchemaResolver(setPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const changePasswordForm = useForm({
    resolver: standardSchemaResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const removePasswordForm = useForm({
    resolver: standardSchemaResolver(removePasswordSchema),
    defaultValues: { currentPassword: '' },
  });

  // Mutations
  const setPasswordMutation = useMutation({
    ...setPasswordMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
      setPasswordModal(null);
      setPasswordForm.reset();
    },
  });

  const changePasswordMutation = useMutation({
    ...changePasswordMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
      setPasswordModal(null);
      changePasswordForm.reset();
    },
  });

  const removePasswordMutation = useMutation({
    ...removePasswordMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
      setPasswordModal(null);
      removePasswordForm.reset();
    },
  });

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

  // Modal close handler
  const closeModal = () => {
    setPasswordModal(null);
    setPasswordForm.reset();
    changePasswordForm.reset();
    removePasswordForm.reset();
  };

  // Form submit handlers
  const handleSetPassword = setPasswordForm.handleSubmit(async (data) => {
    try {
      await setPasswordMutation.mutateAsync({ password: data.password });
    } catch {
      setPasswordForm.setError('root', {
        message: t('profile.password.setModal.error'),
      });
    }
  });

  const handleChangePassword = changePasswordForm.handleSubmit(async (data) => {
    try {
      await changePasswordMutation.mutateAsync({
        current_password: data.currentPassword,
        new_password: data.newPassword,
      });
    } catch (err) {
      const errorCode = (err as { code?: string })?.code;
      if (errorCode === 'INVALID_CURRENT_PASSWORD') {
        changePasswordForm.setError('currentPassword', {
          message: t('profile.password.changeModal.invalidCurrent'),
        });
      } else {
        changePasswordForm.setError('root', {
          message: t('profile.password.changeModal.error'),
        });
      }
    }
  });

  const handleRemovePassword = removePasswordForm.handleSubmit(async (data) => {
    try {
      await removePasswordMutation.mutateAsync({
        current_password: data.currentPassword,
      });
    } catch (err) {
      const errorCode = (err as { code?: string })?.code;
      if (errorCode === 'INVALID_CURRENT_PASSWORD') {
        removePasswordForm.setError('currentPassword', {
          message: t('profile.password.removeModal.invalidCurrent'),
        });
      } else if (errorCode === 'CANNOT_REMOVE_LAST_AUTH_METHOD') {
        removePasswordForm.setError('root', {
          message: t('profile.password.removeModal.noOAuth'),
        });
      } else {
        removePasswordForm.setError('root', {
          message: t('profile.password.removeModal.error'),
        });
      }
    }
  });

  return (
    <AuthPageLayout>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      {/* User Info Card */}
      {user && (
        <div className="mb-4 rounded-lg bg-base-200 p-4">
          <div className="flex flex-col gap-3">
            {/* User ID */}
            <div className="flex items-center gap-3">
              <User className="size-5 text-primary" weight="regular" />
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
              <EnvelopeSimple
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
                <CheckCircle className="size-5 text-success" weight="regular" />
              ) : (
                <XCircle className="size-5 text-error" weight="regular" />
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
                <Key
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
            <SignOut className="size-4" weight="bold" />
            {t('profile.logout')}
          </>
        )}
      </button>

      {/* Set Password Modal */}
      {passwordModal === 'set' && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              {t('profile.password.setModal.title')}
            </h3>
            <p className="py-2 text-base-content/60 text-sm">
              {t('profile.password.setModal.description')}
            </p>
            <form onSubmit={handleSetPassword} className="mt-4">
              <div className="form-control mb-3">
                <label className="label" htmlFor="new-password">
                  <span className="label-text">
                    {t('profile.password.setModal.newPassword')}
                  </span>
                </label>
                <input
                  id="new-password"
                  type="password"
                  className={`input input-bordered ${
                    setPasswordForm.formState.errors.password
                      ? 'input-error'
                      : ''
                  }`}
                  placeholder={t(
                    'profile.password.setModal.newPasswordPlaceholder',
                  )}
                  {...setPasswordForm.register('password')}
                />
                {setPasswordForm.formState.errors.password && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {setPasswordForm.formState.errors.password.message}
                    </span>
                  </label>
                )}
              </div>
              <div className="form-control mb-4">
                <label className="label" htmlFor="confirm-password">
                  <span className="label-text">
                    {t('profile.password.setModal.confirmPassword')}
                  </span>
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className={`input input-bordered ${
                    setPasswordForm.formState.errors.confirmPassword
                      ? 'input-error'
                      : ''
                  }`}
                  placeholder={t(
                    'profile.password.setModal.confirmPasswordPlaceholder',
                  )}
                  {...setPasswordForm.register('confirmPassword')}
                />
                {setPasswordForm.formState.errors.confirmPassword && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {setPasswordForm.formState.errors.confirmPassword.message}
                    </span>
                  </label>
                )}
              </div>
              {setPasswordForm.formState.errors.root && (
                <div className="alert alert-error mb-4">
                  <span>{setPasswordForm.formState.errors.root.message}</span>
                </div>
              )}
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={closeModal}
                  disabled={setPasswordMutation.isPending}
                >
                  {t('profile.password.setModal.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={setPasswordMutation.isPending}
                >
                  {setPasswordMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      {t('profile.password.setModal.submitting')}
                    </>
                  ) : (
                    t('profile.password.setModal.submit')
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closeModal}>
              close
            </button>
          </form>
        </dialog>
      )}

      {/* Change Password Modal */}
      {passwordModal === 'change' && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              {t('profile.password.changeModal.title')}
            </h3>
            <p className="py-2 text-base-content/60 text-sm">
              {t('profile.password.changeModal.description')}
            </p>
            <form onSubmit={handleChangePassword} className="mt-4">
              <div className="form-control mb-3">
                <label className="label" htmlFor="current-password">
                  <span className="label-text">
                    {t('profile.password.changeModal.currentPassword')}
                  </span>
                </label>
                <input
                  id="current-password"
                  type="password"
                  className={`input input-bordered ${
                    changePasswordForm.formState.errors.currentPassword
                      ? 'input-error'
                      : ''
                  }`}
                  placeholder={t(
                    'profile.password.changeModal.currentPasswordPlaceholder',
                  )}
                  {...changePasswordForm.register('currentPassword')}
                />
                {changePasswordForm.formState.errors.currentPassword && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {
                        changePasswordForm.formState.errors.currentPassword
                          .message
                      }
                    </span>
                  </label>
                )}
              </div>
              <div className="form-control mb-3">
                <label className="label" htmlFor="new-password-change">
                  <span className="label-text">
                    {t('profile.password.changeModal.newPassword')}
                  </span>
                </label>
                <input
                  id="new-password-change"
                  type="password"
                  className={`input input-bordered ${
                    changePasswordForm.formState.errors.newPassword
                      ? 'input-error'
                      : ''
                  }`}
                  placeholder={t(
                    'profile.password.changeModal.newPasswordPlaceholder',
                  )}
                  {...changePasswordForm.register('newPassword')}
                />
                {changePasswordForm.formState.errors.newPassword && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {changePasswordForm.formState.errors.newPassword.message}
                    </span>
                  </label>
                )}
              </div>
              <div className="form-control mb-4">
                <label className="label" htmlFor="confirm-password-change">
                  <span className="label-text">
                    {t('profile.password.changeModal.confirmPassword')}
                  </span>
                </label>
                <input
                  id="confirm-password-change"
                  type="password"
                  className={`input input-bordered ${
                    changePasswordForm.formState.errors.confirmPassword
                      ? 'input-error'
                      : ''
                  }`}
                  placeholder={t(
                    'profile.password.changeModal.confirmPasswordPlaceholder',
                  )}
                  {...changePasswordForm.register('confirmPassword')}
                />
                {changePasswordForm.formState.errors.confirmPassword && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {
                        changePasswordForm.formState.errors.confirmPassword
                          .message
                      }
                    </span>
                  </label>
                )}
              </div>
              {changePasswordForm.formState.errors.root && (
                <div className="alert alert-error mb-4">
                  <span>
                    {changePasswordForm.formState.errors.root.message}
                  </span>
                </div>
              )}
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={closeModal}
                  disabled={changePasswordMutation.isPending}
                >
                  {t('profile.password.changeModal.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      {t('profile.password.changeModal.submitting')}
                    </>
                  ) : (
                    t('profile.password.changeModal.submit')
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closeModal}>
              close
            </button>
          </form>
        </dialog>
      )}

      {/* Remove Password Modal */}
      {passwordModal === 'remove' && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              {t('profile.password.removeModal.title')}
            </h3>
            <p className="py-2 text-base-content/60 text-sm">
              {t('profile.password.removeModal.description')}
            </p>
            <form onSubmit={handleRemovePassword} className="mt-4">
              <div className="form-control mb-4">
                <label className="label" htmlFor="current-password-remove">
                  <span className="label-text">
                    {t('profile.password.removeModal.currentPassword')}
                  </span>
                </label>
                <input
                  id="current-password-remove"
                  type="password"
                  className={`input input-bordered ${
                    removePasswordForm.formState.errors.currentPassword
                      ? 'input-error'
                      : ''
                  }`}
                  placeholder={t(
                    'profile.password.removeModal.currentPasswordPlaceholder',
                  )}
                  {...removePasswordForm.register('currentPassword')}
                />
                {removePasswordForm.formState.errors.currentPassword && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {
                        removePasswordForm.formState.errors.currentPassword
                          .message
                      }
                    </span>
                  </label>
                )}
              </div>
              {removePasswordForm.formState.errors.root && (
                <div className="alert alert-error mb-4">
                  <span>
                    {removePasswordForm.formState.errors.root.message}
                  </span>
                </div>
              )}
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={closeModal}
                  disabled={removePasswordMutation.isPending}
                >
                  {t('profile.password.removeModal.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-error"
                  disabled={removePasswordMutation.isPending}
                >
                  {removePasswordMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      {t('profile.password.removeModal.submitting')}
                    </>
                  ) : (
                    t('profile.password.removeModal.submit')
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closeModal}>
              close
            </button>
          </form>
        </dialog>
      )}
    </AuthPageLayout>
  );
}
