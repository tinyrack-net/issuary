import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminTable } from '#admin/components/admin-table.js';
import { PageHeader } from '#admin/components/page-header.js';
import { PaginationControls } from '#admin/components/pagination-controls.js';
import { parseAdminListSearch } from '#admin/libs/admin-list-search.js';
import {
  type AdminUser,
  updateAdminUserEmailVerification,
  updateAdminUserRole,
} from '#admin/libs/api.js';
import {
  adminSessionQueryOptions,
  adminUsersQueryOptions,
} from '#admin/queries/admin.js';
import { queryKeys } from '#admin/queries/keys.js';

function formatDateTime(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleString();
}

function userRoleActionLabel(user: AdminUser): string {
  return user.role === 'admin' ? 'Make user' : 'Make admin';
}

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const search = useRouterState({ select: (state) => state.location.search });
  const [params, setParams] = useState(() => parseAdminListSearch(search));
  const [searchInput, setSearchInput] = useState(params.search);
  const { data: session } = useSuspenseQuery(adminSessionQueryOptions);
  const { data: usersResponse } = useSuspenseQuery(
    adminUsersQueryOptions(params),
  );
  const users = usersResponse.items;
  const pagination = usersResponse.pagination;
  const invalidateUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.users(params) });
  };
  const updateRoleMutation = useMutation({
    mutationFn: updateAdminUserRole,
    onSuccess: invalidateUsers,
  });
  const updateEmailVerificationMutation = useMutation({
    mutationFn: updateAdminUserEmailVerification,
    onSuccess: invalidateUsers,
  });

  return (
    <section className="space-y-6">
      <PageHeader subtitle={t('users.subtitle')} title={t('users.title')} />

      <search>
        <form
          className="card border border-base-300 bg-base-100 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            setParams({ ...params, offset: 0, search: searchInput.trim() });
          }}
        >
          <div className="card-body p-3 sm:p-4">
            <label className="form-control w-full">
              <span className="label pt-0 pb-2">
                <span className="label-text font-medium">
                  {t('users.search')}
                </span>
              </span>
              <div className="md:join flex flex-col gap-2 md:flex-row md:gap-0">
                <input
                  aria-label={t('users.search')}
                  className="input input-bordered md:join-item w-full min-w-0 md:flex-1"
                  onChange={(event) => {
                    setSearchInput(event.currentTarget.value);
                  }}
                  placeholder={t('users.searchPlaceholder')}
                  type="search"
                  value={searchInput}
                />
                <button
                  aria-label={t('users.search')}
                  className="btn btn-primary md:join-item"
                  type="submit"
                >
                  {t('common.search')}
                </button>
              </div>
            </label>
          </div>
        </form>
      </search>

      <AdminTable
        ariaLabel={t('users.tableLabel')}
        columns={[
          { key: 'email', header: t('users.email') },
          { key: 'role', header: t('users.role') },
          { key: 'managedBy', header: t('users.managedBy') },
          { key: 'status', header: t('users.status') },
          { key: 'created', header: t('users.created') },
          { key: 'updated', header: t('users.updated') },
          { key: 'action', header: t('users.action') },
        ]}
        emptyMessage={t('users.empty')}
        getRowKey={(user) => user.sub}
        renderMobileCard={(user) => {
          const nextRole = user.role === 'admin' ? 'user' : 'admin';
          const roleActionDisabled =
            user.managed_by === 'config' ||
            user.sub === session.user.sub ||
            updateRoleMutation.isPending;
          const emailVerificationDisabled =
            user.managed_by === 'config' ||
            updateEmailVerificationMutation.isPending;

          return (
            <article className="card card-compact border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="card-title break-all text-base">
                      {user.email}
                    </h2>
                    <p className="break-all font-mono text-base-content/60 text-xs">
                      {user.sub}
                    </p>
                  </div>
                  <span className="badge badge-primary badge-outline shrink-0">
                    {user.role}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="badge badge-ghost">{user.managed_by}</span>
                  <span
                    className={`badge ${user.email_verified ? 'badge-success' : 'badge-warning badge-outline'}`}
                  >
                    {user.email_verified
                      ? t('users.emailVerified')
                      : t('users.emailUnverified')}
                  </span>
                </div>

                <div className="divider my-0" />

                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-base-content/60">
                      {t('users.created')}
                    </dt>
                    <dd className="text-right">
                      {formatDateTime(user.created_at, t('common.unknown'))}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-base-content/60">
                      {t('users.updated')}
                    </dt>
                    <dd className="text-right">
                      {formatDateTime(user.updated_at, t('common.unknown'))}
                    </dd>
                  </div>
                </dl>

                <div className="rounded-box bg-base-200/70 p-3">
                  <label className="label cursor-pointer justify-between gap-3 p-0">
                    <span className="label-text">
                      {user.email_verified
                        ? t('users.emailVerified')
                        : t('users.emailUnverified')}
                    </span>
                    <input
                      aria-label={t('users.emailVerificationToggle', {
                        email: user.email,
                      })}
                      checked={user.email_verified}
                      className="toggle toggle-primary toggle-sm"
                      disabled={emailVerificationDisabled}
                      onChange={(event) => {
                        updateEmailVerificationMutation.mutate({
                          email_verified: event.currentTarget.checked,
                          sub: user.sub,
                        });
                      }}
                      type="checkbox"
                    />
                  </label>
                </div>

                <button
                  aria-label={`${userRoleActionLabel(user)} for ${user.email}`}
                  className="btn btn-outline btn-sm w-full"
                  disabled={roleActionDisabled}
                  onClick={() => {
                    updateRoleMutation.mutate({
                      role: nextRole,
                      sub: user.sub,
                    });
                  }}
                  title={
                    roleActionDisabled
                      ? t('users.roleActionUnavailable')
                      : t('users.roleAction')
                  }
                  type="button"
                >
                  {updateRoleMutation.isPending
                    ? t('users.updatingRole')
                    : nextRole === 'admin'
                      ? t('users.makeAdmin')
                      : t('users.makeUser')}
                </button>
              </div>
            </article>
          );
        }}
        renderRow={(user) => {
          const nextRole = user.role === 'admin' ? 'user' : 'admin';
          const roleActionDisabled =
            user.managed_by === 'config' ||
            user.sub === session.user.sub ||
            updateRoleMutation.isPending;
          const emailVerificationDisabled =
            user.managed_by === 'config' ||
            updateEmailVerificationMutation.isPending;

          return (
            <tr>
              <td className="min-w-56">
                <div className="break-all font-medium">{user.email}</div>
                <div className="break-all text-base-content/60 text-xs">
                  {user.sub}
                </div>
              </td>
              <td>
                <span className="badge badge-primary badge-outline">
                  {user.role}
                </span>
              </td>
              <td>
                <span className="badge badge-ghost">{user.managed_by}</span>
              </td>
              <td>
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    aria-label={t('users.emailVerificationToggle', {
                      email: user.email,
                    })}
                    checked={user.email_verified}
                    className="toggle toggle-primary toggle-sm"
                    disabled={emailVerificationDisabled}
                    onChange={(event) => {
                      updateEmailVerificationMutation.mutate({
                        email_verified: event.currentTarget.checked,
                        sub: user.sub,
                      });
                    }}
                    type="checkbox"
                  />
                  <span className="label-text">
                    {user.email_verified
                      ? t('users.emailVerified')
                      : t('users.emailUnverified')}
                  </span>
                </label>
              </td>
              <td className="whitespace-nowrap">
                {formatDateTime(user.created_at, t('common.unknown'))}
              </td>
              <td className="whitespace-nowrap">
                {formatDateTime(user.updated_at, t('common.unknown'))}
              </td>
              <td>
                <button
                  aria-label={`${userRoleActionLabel(user)} for ${user.email}`}
                  className="btn btn-outline btn-xs whitespace-nowrap"
                  disabled={roleActionDisabled}
                  onClick={() => {
                    updateRoleMutation.mutate({
                      role: nextRole,
                      sub: user.sub,
                    });
                  }}
                  title={
                    roleActionDisabled
                      ? t('users.roleActionUnavailable')
                      : t('users.roleAction')
                  }
                  type="button"
                >
                  {updateRoleMutation.isPending
                    ? t('users.updatingRole')
                    : nextRole === 'admin'
                      ? t('users.makeAdmin')
                      : t('users.makeUser')}
                </button>
              </td>
            </tr>
          );
        }}
        rows={users}
      />

      <PaginationControls
        limit={pagination.limit}
        offset={pagination.offset}
        onOffsetChange={(offset) => {
          setParams({ ...params, offset });
        }}
        total={pagination.total}
      />
    </section>
  );
}
