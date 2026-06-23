import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminDisabledPanel } from '#frontend/features/admin/admin-disabled-panel.tsx';
import { AdminShell } from '#frontend/features/admin/admin-shell.tsx';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';
import {
  type AdminUser,
  adminUsersQueryOptions,
  createAdminUser,
  deleteAdminUser,
  normalizeAdminUsersQuery,
  updateAdminUser,
} from '#frontend/queries/admin-users.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { SessionUser } from '#frontend/queries/session.ts';

export const Route = createFileRoute('/admin/users/')({
  component: AdminUsersPage,
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/login' });
    }
  },
});

type UserModalState =
  | { type: 'create' }
  | { type: 'edit'; user: AdminUser }
  | { type: 'delete'; user: AdminUser }
  | null;

type QuickFilter = 'all' | 'database' | 'config' | 'admins';

type NoticeState = { tone: 'success' | 'error'; message: string } | null;

function AdminUsersPage() {
  const { t } = useTranslation();
  const user = Route.useRouteContext({ select: (context) => context.user });

  if (user?.role !== 'admin') {
    return (
      <PageLayout cardPadding maxWidth="md">
        <h1 className="mb-2 text-center font-bold text-2xl">
          {t('admin.accessRequired')}
        </h1>
        <p className="text-center text-base-content/60">
          {t('admin.accessRequiredDescription')}
        </p>
      </PageLayout>
    );
  }

  return <AdminUsersGate user={user} />;
}

function AdminUsersGate({ user }: { user: SessionUser }) {
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  if (!config.admin.enabled) {
    return <AdminDisabledPanel />;
  }
  return <AdminUsersContent user={user} />;
}

function AdminUsersContent({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draftQuery, setDraftQuery] = useState('');
  const [draftIncludeDeleted, setDraftIncludeDeleted] = useState(false);
  const [filters, setFilters] = useState(() => normalizeAdminUsersQuery());
  const [notice, setNotice] = useState<NoticeState>(null);
  const [modal, setModal] = useState<UserModalState>(null);
  const { data } = useSuspenseQuery(adminUsersQueryOptions(filters));

  const activeUsers = data.users.filter(
    (managedUser) => !managedUser.deleted_at,
  ).length;
  const configUsers = data.users.filter(
    (managedUser) => managedUser.managed_by === 'config',
  ).length;
  const databaseUsers = data.users.filter(
    (managedUser) => managedUser.managed_by === 'database',
  ).length;
  const activeQuickFilter = getActiveQuickFilter(filters);
  const hasActiveFilters =
    filters.query !== '' ||
    filters.includeDeleted ||
    filters.managedBy !== undefined ||
    filters.role !== undefined;
  const pageStart =
    data.pagination.total === 0
      ? 0
      : (data.pagination.page - 1) * data.pagination.page_size + 1;
  const pageEnd = Math.min(
    data.pagination.page * data.pagination.page_size,
    data.pagination.total,
  );

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: ({ user: nextUser }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setNotice({
        tone: 'success',
        message: t('admin.users.createdNotice', { email: nextUser.email }),
      });
      setModal(null);
    },
    onError: () => {
      setNotice({ tone: 'error', message: t('admin.users.operationFailed') });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAdminUser,
    onSuccess: ({ user: nextUser }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setNotice({
        tone: 'success',
        message: t('admin.users.updatedNotice', { email: nextUser.email }),
      });
      setModal(null);
    },
    onError: () => {
      setNotice({ tone: 'error', message: t('admin.users.operationFailed') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: ({ user: nextUser }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setNotice({
        tone: 'success',
        message: t('admin.users.deletedNotice', { email: nextUser.email }),
      });
      setModal(null);
    },
    onError: () => {
      setNotice({ tone: 'error', message: t('admin.users.operationFailed') });
    },
  });

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const applySearch = () => {
    setFilters((current) => ({
      ...current,
      query: draftQuery.trim(),
      includeDeleted: draftIncludeDeleted,
      page: 1,
    }));
  };

  const clearFilters = () => {
    setDraftQuery('');
    setDraftIncludeDeleted(false);
    setFilters(normalizeAdminUsersQuery());
  };

  const setPageSize = (pageSize: number) => {
    setFilters((current) => ({ ...current, page: 1, pageSize }));
  };

  const applyQuickFilter = (nextFilter: QuickFilter) => {
    setFilters((current) => ({
      ...current,
      page: 1,
      managedBy:
        nextFilter === 'database'
          ? 'database'
          : nextFilter === 'config'
            ? 'config'
            : undefined,
      role: nextFilter === 'admins' ? 'admin' : undefined,
    }));
  };

  return (
    <AdminShell
      current="users"
      description={t('admin.users.description')}
      title={t('admin.users.title')}
      user={user}
    >
      <div className="stats stats-vertical lg:stats-horizontal w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.035] shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <SummaryStat
          label={t('admin.users.activeOnPage')}
          value={activeUsers}
        />
        <SummaryStat
          label={t('admin.users.configOnPage')}
          value={configUsers}
        />
        <SummaryStat
          label={t('admin.users.databaseOnPage')}
          value={databaseUsers}
        />
      </div>

      {notice ? (
        <div
          aria-live={notice.tone === 'success' ? 'polite' : 'assertive'}
          className={
            notice.tone === 'success'
              ? 'alert mt-6 border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
              : 'alert mt-6 border-red-300/20 bg-red-300/10 text-red-100'
          }
          role={notice.tone === 'success' ? 'status' : 'alert'}
        >
          <span>{notice.tone === 'success' ? '✓' : '!'}</span>
          <span>{notice.message}</span>
          <button
            aria-label={t('common.close')}
            className="btn btn-ghost btn-xs ml-auto text-current"
            onClick={() => setNotice(null)}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}

      <section className="card mt-6 overflow-hidden border border-white/10 bg-white/[0.035] shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="card-body gap-5 p-0">
          <div className="flex flex-col gap-4 border-white/10 border-b bg-white/[0.015] p-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.75)]" />
                <span className="font-medium text-slate-500 text-xs uppercase tracking-[0.18em]">
                  {t('admin.users.directoryEyebrow')}
                </span>
              </div>
              <h2 className="card-title text-slate-100">
                {t('admin.users.directory')}
              </h2>
              <p className="mt-1 text-slate-400 text-sm">
                {t('admin.users.total', { count: data.pagination.total })}
              </p>
            </div>
            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <input
                  aria-label={t('admin.users.searchPlaceholder')}
                  className="input input-bordered h-11 w-full border-white/10 bg-black/20 text-slate-200 placeholder:text-slate-500 focus:border-[#7170ff]/60 lg:w-80"
                  onChange={(event) => setDraftQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch();
                  }}
                  placeholder={t('admin.users.searchPlaceholder')}
                  type="search"
                  value={draftQuery}
                />
                <label className="label cursor-pointer justify-start gap-2 rounded-box border border-white/10 bg-black/20 px-3 py-2">
                  <input
                    checked={draftIncludeDeleted}
                    className="checkbox checkbox-sm border-white/20 bg-white/[0.04] checked:border-[#7170ff] checked:bg-[#7170ff]"
                    onChange={(event) =>
                      setDraftIncludeDeleted(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span className="label-text text-slate-300">
                    {t('admin.users.includeDeleted')}
                  </span>
                </label>
                <button
                  className="btn btn-outline border-white/10 bg-white/[0.035] text-slate-200 hover:border-[#7170ff]/40 hover:bg-[#7170ff]/15"
                  onClick={applySearch}
                  type="button"
                >
                  {t('admin.users.search')}
                </button>
                <button
                  className="btn btn-primary border-0 bg-[#7170ff] text-white shadow-[0_14px_40px_rgba(113,112,255,0.32)] hover:bg-[#828fff]"
                  onClick={() => setModal({ type: 'create' })}
                  type="button"
                >
                  {t('admin.users.create')}
                </button>
              </div>
              <div className="join rounded-box border border-white/10 bg-black/20 p-1">
                <QuickFilterButton
                  active={activeQuickFilter === 'all'}
                  label={t('admin.users.filter.all')}
                  onClick={() => applyQuickFilter('all')}
                />
                <QuickFilterButton
                  active={activeQuickFilter === 'database'}
                  label={t('admin.users.filter.database')}
                  onClick={() => applyQuickFilter('database')}
                />
                <QuickFilterButton
                  active={activeQuickFilter === 'config'}
                  label={t('admin.users.filter.config')}
                  onClick={() => applyQuickFilter('config')}
                />
                <QuickFilterButton
                  active={activeQuickFilter === 'admins'}
                  label={t('admin.users.filter.admins')}
                  onClick={() => applyQuickFilter('admins')}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-6">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">
                {t('admin.users.showingRange', {
                  from: pageStart,
                  to: pageEnd,
                  total: data.pagination.total,
                })}
              </span>
              {filters.query ? (
                <span className="badge badge-outline border-[#7170ff]/30 bg-[#7170ff]/10 text-[#c7c8ff]">
                  {t('admin.users.queryChip', { query: filters.query })}
                </span>
              ) : null}
              {filters.includeDeleted ? (
                <span className="badge badge-outline border-amber-300/25 bg-amber-300/10 text-amber-100">
                  {t('admin.users.includeDeleted')}
                </span>
              ) : null}
              {activeQuickFilter !== 'all' ? (
                <span className="badge badge-outline border-white/15 text-slate-300">
                  {t(`admin.users.filter.${activeQuickFilter}`)}
                </span>
              ) : null}
              {hasActiveFilters ? (
                <button
                  className="btn btn-ghost btn-xs text-slate-400"
                  onClick={clearFilters}
                  type="button"
                >
                  {t('admin.users.clearFilters')}
                </button>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-slate-500 text-sm">
              <span>{t('admin.users.pageSize')}</span>
              <select
                aria-label={t('admin.users.pageSize')}
                className="select select-bordered select-xs border-white/10 bg-black/20 text-slate-200"
                onChange={(event) => setPageSize(Number(event.target.value))}
                value={filters.pageSize}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div className="overflow-x-auto px-0 pb-2">
            <table className="table-zebra table [&_tbody_tr:hover]:bg-white/[0.04] [&_tbody_tr]:border-white/5 [&_tbody_tr]:transition [&_td]:border-white/5 [&_thead_th]:border-white/10 [&_thead_th]:bg-white/[0.035] [&_thead_th]:text-slate-500">
              <thead>
                <tr>
                  <th>{t('profile.email.label')}</th>
                  <th>{t('admin.users.role')}</th>
                  <th>{t('admin.users.source')}</th>
                  <th>{t('admin.users.emailVerified')}</th>
                  <th>{t('admin.users.secondFactor')}</th>
                  <th>{t('admin.users.status')}</th>
                  <th>{t('admin.users.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((managedUser) => (
                  <tr key={managedUser.sub}>
                    <td>
                      <div className="font-medium text-slate-100">
                        {managedUser.email}
                      </div>
                      <div className="max-w-64 truncate font-mono text-slate-600 text-xs">
                        {managedUser.sub}
                      </div>
                    </td>
                    <td>
                      <Badge
                        tone={
                          managedUser.role === 'admin' ? 'neutral' : 'ghost'
                        }
                      >
                        {formatAdminRole(t, managedUser.role)}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        tone={
                          managedUser.managed_by === 'config'
                            ? 'warning'
                            : 'info'
                        }
                      >
                        {formatManagedBy(t, managedUser.managed_by)}
                      </Badge>
                    </td>
                    <td>
                      {managedUser.email_verified
                        ? t('common.yes')
                        : t('common.no')}
                    </td>
                    <td>
                      {managedUser.totp_registered
                        ? t('admin.users.secondFactorTotp')
                        : managedUser.passkey_count > 0
                          ? t(
                              managedUser.passkey_count === 1
                                ? 'admin.users.secondFactorPasskey'
                                : 'admin.users.secondFactorPasskeys',
                              { count: managedUser.passkey_count },
                            )
                          : t('common.none')}
                    </td>
                    <td>
                      <Badge
                        tone={managedUser.deleted_at ? 'error' : 'success'}
                      >
                        {managedUser.deleted_at
                          ? t('admin.users.deleted')
                          : t('admin.users.active')}
                      </Badge>
                    </td>
                    <td>
                      {managedUser.managed_by === 'database' &&
                      !managedUser.deleted_at ? (
                        <div className="join rounded-xl border border-white/10 bg-black/20">
                          <button
                            aria-label={t('admin.users.editUser', {
                              email: managedUser.email,
                            })}
                            className="btn join-item btn-ghost btn-xs text-slate-300 hover:bg-white/[0.06]"
                            onClick={() =>
                              setModal({ type: 'edit', user: managedUser })
                            }
                            type="button"
                          >
                            {t('admin.users.edit')}
                          </button>
                          <button
                            aria-label={t('admin.users.deleteUser', {
                              email: managedUser.email,
                            })}
                            className="btn join-item btn-error btn-outline btn-xs border-red-400/25 bg-red-400/5 text-red-200 hover:bg-red-400/15"
                            onClick={() =>
                              setModal({ type: 'delete', user: managedUser })
                            }
                            type="button"
                          >
                            {t('admin.users.delete')}
                          </button>
                        </div>
                      ) : (
                        <span className="badge badge-outline border-white/15 text-slate-400">
                          {t('admin.users.readonly')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.users.length === 0 ? (
                  <tr>
                    <td
                      className="py-12 text-center text-slate-500"
                      colSpan={7}
                    >
                      {t('admin.users.emptyFiltered')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-white/10 border-t bg-white/[0.015] p-5">
            <button
              className="btn btn-outline btn-sm border-white/10 bg-white/[0.035] text-slate-300 hover:border-[#7170ff]/40 hover:bg-[#7170ff]/15"
              disabled={filters.page <= 1}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page - 1,
                }))
              }
              type="button"
            >
              {t('admin.users.previous')}
            </button>
            <span className="badge badge-ghost border-white/10 bg-black/20 text-slate-400">
              {t('admin.users.page', { page: data.pagination.page })}
            </span>
            <button
              className="btn btn-outline btn-sm border-white/10 bg-white/[0.035] text-slate-300 hover:border-[#7170ff]/40 hover:bg-[#7170ff]/15"
              disabled={
                data.pagination.page * data.pagination.page_size >=
                data.pagination.total
              }
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
              type="button"
            >
              {t('admin.users.next')}
            </button>
          </div>
        </div>
      </section>

      <UserFormModal
        isMutating={isMutating}
        modal={modal}
        onClose={() => setModal(null)}
        onCreate={(values) => createMutation.mutate(values)}
        onDelete={(sub) => deleteMutation.mutate(sub)}
        onUpdate={(values) => updateMutation.mutate(values)}
      />
    </AdminShell>
  );
}

function UserFormModal({
  modal,
  isMutating,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  modal: UserModalState;
  isMutating: boolean;
  onClose: () => void;
  onCreate: (values: {
    email: string;
    password: string;
    role: 'user' | 'admin';
    email_verified: boolean;
  }) => void;
  onUpdate: (values: {
    sub: string;
    email: string;
    role: 'user' | 'admin';
    email_verified: boolean;
  }) => void;
  onDelete: (sub: string) => void;
}) {
  const { t } = useTranslation();
  const defaultValues = useMemo(
    () => (modal?.type === 'edit' ? modal.user : null),
    [modal],
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modal) return undefined;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    return () => {
      previousFocus?.focus();
    };
  }, [modal]);

  if (!modal) return null;

  if (modal.type === 'delete') {
    return (
      <div className="modal modal-open bg-black/70 backdrop-blur-sm">
        <div
          aria-labelledby="admin-delete-user-title"
          aria-modal="true"
          className="modal-box border border-white/10 bg-[#101217] text-slate-100 shadow-[0_32px_100px_rgba(0,0,0,0.55)]"
          onKeyDown={(event) => trapDialogFocus(event, onClose)}
          ref={dialogRef}
          role="dialog"
        >
          <h3
            className="font-semibold text-xl tracking-[-0.03em]"
            id="admin-delete-user-title"
          >
            {t('admin.users.deleteTitle', { email: modal.user.email })}
          </h3>
          <div className="my-4 rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-red-100">
            <p className="font-medium">{t('admin.users.deleteWarning')}</p>
            <p className="mt-1 text-red-100/70 text-sm">
              {t('admin.users.deleteDescription')}
            </p>
          </div>
          <div className="modal-action">
            <button
              className="btn border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
              onClick={onClose}
              type="button"
            >
              {t('admin.users.cancel')}
            </button>
            <button
              className="btn btn-error border-0 bg-red-500/80 text-white hover:bg-red-500"
              disabled={isMutating}
              onClick={() => onDelete(modal.user.sub)}
              type="button"
            >
              {t('admin.users.deleteConfirm')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const title =
    modal.type === 'create'
      ? t('admin.users.create')
      : t('admin.users.editTitle');
  const submit =
    modal.type === 'create'
      ? t('admin.users.createSubmit')
      : t('admin.users.save');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = {
      email: String(formData.get('email') ?? ''),
      role: parseUserRole(formData.get('role')),
      email_verified: formData.get('email_verified') === 'on',
    };
    if (modal.type === 'create') {
      onCreate({
        ...values,
        password: String(formData.get('password') ?? ''),
      });
    } else {
      onUpdate({
        sub: modal.user.sub,
        ...values,
      });
    }
  };

  return (
    <div className="modal modal-open bg-black/70 backdrop-blur-sm">
      <div
        aria-labelledby="admin-user-form-title"
        aria-modal="true"
        className="modal-box border border-white/10 bg-[#101217] text-slate-100 shadow-[0_32px_100px_rgba(0,0,0,0.55)]"
        onKeyDown={(event) => trapDialogFocus(event, onClose)}
        ref={dialogRef}
        role="dialog"
      >
        <h3
          className="font-semibold text-xl tracking-[-0.03em]"
          id="admin-user-form-title"
        >
          {title}
        </h3>
        <p className="mt-2 text-slate-500 text-sm">
          {modal.type === 'create'
            ? t('admin.users.createHint')
            : t('admin.users.editHint')}
        </p>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <fieldset className="fieldset">
            <legend className="fieldset-legend text-slate-400">
              {t('profile.email.label')}
            </legend>
            <input
              aria-label={t('profile.email.label')}
              className="input input-bordered w-full border-white/10 bg-black/20 text-slate-100 focus:border-[#7170ff]/60"
              defaultValue={defaultValues?.email ?? ''}
              name="email"
              required
              type="email"
            />
          </fieldset>
          {modal.type === 'create' ? (
            <fieldset className="fieldset">
              <legend className="fieldset-legend text-slate-400">
                {t('admin.users.password')}
              </legend>
              <input
                aria-label={t('admin.users.password')}
                className="input input-bordered w-full border-white/10 bg-black/20 text-slate-100 focus:border-[#7170ff]/60"
                name="password"
                required
                type="password"
              />
            </fieldset>
          ) : null}
          <fieldset className="fieldset">
            <legend className="fieldset-legend text-slate-400">
              {t('admin.users.role')}
            </legend>
            <select
              aria-label={t('admin.users.role')}
              className="select select-bordered w-full border-white/10 bg-black/20 text-slate-100 focus:border-[#7170ff]/60"
              defaultValue={defaultValues?.role ?? 'user'}
              name="role"
            >
              <option value="user">{t('admin.users.roleUser')}</option>
              <option value="admin">{t('admin.users.roleAdmin')}</option>
            </select>
          </fieldset>
          <label className="label cursor-pointer justify-start gap-3 rounded-box border border-white/10 bg-black/20 px-3 py-2">
            <input
              className="checkbox border-white/20 bg-white/[0.04] checked:border-[#7170ff] checked:bg-[#7170ff]"
              defaultChecked={defaultValues?.email_verified ?? false}
              name="email_verified"
              type="checkbox"
            />
            <span className="label-text text-slate-300">
              {t('admin.users.emailVerified')}
            </span>
          </label>
          <div className="modal-action">
            <button
              className="btn border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
              onClick={onClose}
              type="button"
            >
              {t('admin.users.cancel')}
            </button>
            <button
              className="btn btn-primary border-0 bg-[#7170ff] text-white shadow-[0_14px_40px_rgba(113,112,255,0.32)] hover:bg-[#828fff]"
              disabled={isMutating}
              type="submit"
            >
              {submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function trapDialogFocus(
  event: KeyboardEvent<HTMLDivElement>,
  onClose: () => void,
) {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }

  if (event.key !== 'Tab') return;

  const focusableElements = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );

  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1);
  if (!firstElement || !lastElement) return;

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function formatAdminRole(
  t: ReturnType<typeof useTranslation>['t'],
  role: AdminUser['role'],
) {
  return role === 'admin'
    ? t('admin.users.roleAdmin')
    : t('admin.users.roleUser');
}

function formatManagedBy(
  t: ReturnType<typeof useTranslation>['t'],
  managedBy: AdminUser['managed_by'],
) {
  return managedBy === 'database'
    ? t('admin.users.sourceDatabase')
    : t('admin.users.sourceConfig');
}

function parseUserRole(value: FormDataEntryValue | null): 'user' | 'admin' {
  return value === 'admin' ? 'admin' : 'user';
}

function getActiveQuickFilter(
  filters: ReturnType<typeof normalizeAdminUsersQuery>,
): QuickFilter {
  if (filters.role === 'admin') return 'admins';
  if (filters.managedBy === 'database') return 'database';
  if (filters.managedBy === 'config') return 'config';
  return 'all';
}

function QuickFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? 'btn join-item btn-xs border-0 bg-[#7170ff] text-white'
          : 'btn join-item btn-ghost btn-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  const { t } = useTranslation();
  return (
    <div className="stat border-white/10 bg-transparent p-6">
      <div className="stat-title text-slate-500">{label}</div>
      <div className="stat-value mt-1 text-slate-50 tracking-[-0.06em]">
        {value}
      </div>
      <div className="stat-desc text-slate-600">
        {t('admin.users.currentPage')}
      </div>
    </div>
  );
}

type BadgeTone = 'neutral' | 'ghost' | 'warning' | 'info' | 'success' | 'error';

const badgeClasses: Record<BadgeTone, string> = {
  neutral: 'badge-primary border-[#7170ff]/30 bg-[#7170ff]/20 text-[#c7c8ff]',
  ghost: 'badge-ghost border-white/10 bg-white/[0.035] text-slate-400',
  warning: 'badge-warning border-amber-300/25 bg-amber-300/15 text-amber-100',
  info: 'badge-info border-sky-300/25 bg-sky-300/15 text-sky-100',
  success:
    'badge-success border-emerald-300/25 bg-emerald-300/15 text-emerald-100',
  error: 'badge-error border-red-300/25 bg-red-300/15 text-red-100',
};

function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge ${badgeClasses[tone]}`}>{children}</span>;
}
