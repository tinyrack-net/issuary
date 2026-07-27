import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import { TRTable } from '@tinyrack/ui/components/table';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { AdminGateScreen } from '#frontend/features/admin/admin-gate-screen.tsx';
import { AdminShell } from '#frontend/features/admin/admin-shell.tsx';
import { AdminStat } from '#frontend/features/admin/admin-stat.tsx';
import {
  formatAdminRole,
  formatManagedBy,
} from '#frontend/features/admin/format-admin-user.ts';
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
  const user = Route.useRouteContext({ select: (context) => context.user });

  if (user?.role !== 'admin') {
    return <AdminGateScreen reason="access-required" />;
  }

  return <AdminUsersGate user={user} />;
}

function AdminUsersGate({ user }: { user: SessionUser }) {
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  if (!config.admin.enabled) {
    return <AdminGateScreen reason="console-disabled" />;
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
      <div className="flex flex-col overflow-hidden rounded-tinyrack-lg border border-tinyrack-border bg-tinyrack-surface shadow-tinyrack-raised lg:flex-row lg:divide-x lg:divide-tinyrack-border">
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
              ? 'mt-6 flex items-center gap-2 rounded-tinyrack-md border border-tinyrack-success-border bg-tinyrack-success-surface px-4 py-3 text-tinyrack-success'
              : 'mt-6 flex items-center gap-2 rounded-tinyrack-md border border-tinyrack-danger-border bg-tinyrack-danger-surface px-4 py-3 text-tinyrack-danger'
          }
          role={notice.tone === 'success' ? 'status' : 'alert'}
        >
          <span>{notice.tone === 'success' ? '✓' : '!'}</span>
          <span>{notice.message}</span>
          <TRButton
            appearance="ghost"
            className="ml-auto"
            onClick={() => setNotice(null)}
            type="button"
            uiSize="sm"
          >
            ×
          </TRButton>
        </div>
      ) : null}

      <TRCard.Root
        className="mt-6 overflow-hidden shadow-tinyrack-raised"
        variant="outlined"
      >
        <TRCard.Content className="gap-5 p-0">
          <div className="flex flex-col gap-4 border-tinyrack-border border-b bg-tinyrack-surface-muted p-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-tinyrack-full bg-tinyrack-success" />
                <span className="font-medium text-tinyrack-text-muted text-tinyrack-xs uppercase tracking-wider">
                  {t('admin.users.directoryEyebrow')}
                </span>
              </div>
              <TRCard.Title>{t('admin.users.directory')}</TRCard.Title>
              <TRCard.Description className="mt-1 text-tinyrack-sm">
                {t('admin.users.total', { count: data.pagination.total })}
              </TRCard.Description>
            </div>
            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <TRInput
                  aria-label={t('admin.users.searchPlaceholder')}
                  className="w-full lg:w-80"
                  onChange={(event) => setDraftQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch();
                  }}
                  placeholder={t('admin.users.searchPlaceholder')}
                  type="search"
                  uiSize="sm"
                  value={draftQuery}
                />
                <label className="flex cursor-pointer items-center justify-start gap-2 rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface px-3 py-2">
                  <input
                    checked={draftIncludeDeleted}
                    className="size-4 rounded-tinyrack-xs border-tinyrack-control-border accent-tinyrack-primary"
                    onChange={(event) =>
                      setDraftIncludeDeleted(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span className="text-tinyrack-sm text-tinyrack-text-muted">
                    {t('admin.users.includeDeleted')}
                  </span>
                </label>
                <TRButton
                  appearance="outline"
                  onClick={applySearch}
                  type="button"
                  uiSize="sm"
                >
                  {t('admin.users.search')}
                </TRButton>
                <TRButton
                  intent="primary"
                  onClick={() => setModal({ type: 'create' })}
                  type="button"
                  uiSize="sm"
                >
                  {t('admin.users.create')}
                </TRButton>
              </div>
              <div className="inline-flex items-center gap-0.5 rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface-muted p-1">
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
            <div className="flex flex-wrap items-center gap-2 text-tinyrack-sm">
              <span className="text-tinyrack-text-muted">
                {t('admin.users.showingRange', {
                  from: pageStart,
                  to: pageEnd,
                  total: data.pagination.total,
                })}
              </span>
              {filters.query ? (
                <TRBadge uiSize="sm" variant="neutral">
                  {t('admin.users.queryChip', { query: filters.query })}
                </TRBadge>
              ) : null}
              {filters.includeDeleted ? (
                <TRBadge uiSize="sm" variant="warning">
                  {t('admin.users.includeDeleted')}
                </TRBadge>
              ) : null}
              {activeQuickFilter !== 'all' ? (
                <TRBadge uiSize="sm">
                  {t(`admin.users.filter.${activeQuickFilter}`)}
                </TRBadge>
              ) : null}
              {hasActiveFilters ? (
                <TRButton
                  appearance="ghost"
                  onClick={clearFilters}
                  type="button"
                  uiSize="sm"
                >
                  {t('admin.users.clearFilters')}
                </TRButton>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-tinyrack-sm text-tinyrack-text-muted">
              <span>{t('admin.users.pageSize')}</span>
              <select
                aria-label={t('admin.users.pageSize')}
                className="rounded-tinyrack-sm border border-tinyrack-control-border bg-tinyrack-surface px-2 py-1 text-tinyrack-text text-tinyrack-xs focus:border-tinyrack-focus focus:outline-hidden"
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
            <TRTable.Root density="compact" striped>
              <TRTable.Header>
                <TRTable.Row>
                  <TRTable.Head>{t('profile.email.label')}</TRTable.Head>
                  <TRTable.Head>{t('admin.users.role')}</TRTable.Head>
                  <TRTable.Head>{t('admin.users.source')}</TRTable.Head>
                  <TRTable.Head>{t('admin.users.emailVerified')}</TRTable.Head>
                  <TRTable.Head>{t('admin.users.secondFactor')}</TRTable.Head>
                  <TRTable.Head>{t('admin.users.status')}</TRTable.Head>
                  <TRTable.Head>{t('admin.users.actions')}</TRTable.Head>
                </TRTable.Row>
              </TRTable.Header>
              <TRTable.Body>
                {data.users.map((managedUser) => (
                  <TRTable.Row key={managedUser.sub}>
                    <TRTable.Cell>
                      <div className="font-medium text-tinyrack-text">
                        {managedUser.email}
                      </div>
                      <div className="max-w-64 truncate font-mono text-tinyrack-text-muted text-tinyrack-xs">
                        {managedUser.sub}
                      </div>
                    </TRTable.Cell>
                    <TRTable.Cell>
                      <TRBadge
                        uiSize="sm"
                        variant={
                          managedUser.role === 'admin' ? 'neutral' : undefined
                        }
                      >
                        {formatAdminRole(t, managedUser.role)}
                      </TRBadge>
                    </TRTable.Cell>
                    <TRTable.Cell>
                      <TRBadge
                        uiSize="sm"
                        variant={
                          managedUser.managed_by === 'config'
                            ? 'warning'
                            : 'info'
                        }
                      >
                        {formatManagedBy(t, managedUser.managed_by)}
                      </TRBadge>
                    </TRTable.Cell>
                    <TRTable.Cell>
                      {managedUser.email_verified
                        ? t('common.yes')
                        : t('common.no')}
                    </TRTable.Cell>
                    <TRTable.Cell>
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
                    </TRTable.Cell>
                    <TRTable.Cell>
                      <TRBadge
                        uiSize="sm"
                        variant={managedUser.deleted_at ? 'danger' : 'success'}
                      >
                        {managedUser.deleted_at
                          ? t('admin.users.deleted')
                          : t('admin.users.active')}
                      </TRBadge>
                    </TRTable.Cell>
                    <TRTable.Cell>
                      {managedUser.managed_by === 'database' &&
                      !managedUser.deleted_at ? (
                        <div className="inline-flex items-center rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface-muted">
                          <TRButton
                            appearance="ghost"
                            aria-label={t('admin.users.editUser', {
                              email: managedUser.email,
                            })}
                            onClick={() =>
                              setModal({ type: 'edit', user: managedUser })
                            }
                            type="button"
                            uiSize="sm"
                          >
                            {t('admin.users.edit')}
                          </TRButton>
                          <TRButton
                            appearance="outline"
                            aria-label={t('admin.users.deleteUser', {
                              email: managedUser.email,
                            })}
                            intent="danger"
                            onClick={() =>
                              setModal({ type: 'delete', user: managedUser })
                            }
                            type="button"
                            uiSize="sm"
                          >
                            {t('admin.users.delete')}
                          </TRButton>
                        </div>
                      ) : (
                        <TRBadge uiSize="sm">
                          {t('admin.users.readonly')}
                        </TRBadge>
                      )}
                    </TRTable.Cell>
                  </TRTable.Row>
                ))}
                {data.users.length === 0 ? (
                  <TRTable.Row>
                    <TRTable.Cell
                      className="py-12 text-center text-tinyrack-text-muted"
                      colSpan={7}
                    >
                      {t('admin.users.emptyFiltered')}
                    </TRTable.Cell>
                  </TRTable.Row>
                ) : null}
              </TRTable.Body>
            </TRTable.Root>
          </div>

          <div className="flex items-center justify-between border-tinyrack-border border-t bg-tinyrack-surface-muted p-5">
            <TRButton
              appearance="outline"
              disabled={filters.page <= 1}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page - 1,
                }))
              }
              type="button"
              uiSize="sm"
            >
              {t('admin.users.previous')}
            </TRButton>
            <TRBadge uiSize="sm">
              {t('admin.users.page', { page: data.pagination.page })}
            </TRBadge>
            <TRButton
              appearance="outline"
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
              uiSize="sm"
            >
              {t('admin.users.next')}
            </TRButton>
          </div>
        </TRCard.Content>
      </TRCard.Root>

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

  if (!modal) return null;

  if (modal.type === 'delete') {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title={t('admin.users.deleteTitle', { email: modal.user.email })}
        variant="destructive"
      >
        <div className="my-4 rounded-tinyrack-md border border-tinyrack-danger-border bg-tinyrack-danger-surface p-4 text-tinyrack-danger">
          <p className="font-medium">{t('admin.users.deleteWarning')}</p>
          <p className="mt-1 text-tinyrack-sm opacity-80">
            {t('admin.users.deleteDescription')}
          </p>
        </div>
        <ModalActions>
          <TRButton
            disabled={isMutating}
            onClick={onClose}
            type="button"
            uiSize="sm"
          >
            {t('admin.users.cancel')}
          </TRButton>
          <TRButton
            disabled={isMutating}
            intent="danger"
            onClick={() => onDelete(modal.user.sub)}
            type="button"
            uiSize="sm"
          >
            {t('admin.users.deleteConfirm')}
          </TRButton>
        </ModalActions>
      </Modal>
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
    <Modal
      description={
        modal.type === 'create'
          ? t('admin.users.createHint')
          : t('admin.users.editHint')
      }
      isOpen
      onClose={onClose}
      title={title}
    >
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <TRField.Root>
          <TRField.Label htmlFor="admin-user-email">
            {t('profile.email.label')}
          </TRField.Label>
          <TRInput
            defaultValue={defaultValues?.email ?? ''}
            id="admin-user-email"
            name="email"
            required
            type="email"
            uiSize="sm"
          />
        </TRField.Root>
        {modal.type === 'create' ? (
          <TRField.Root>
            <TRField.Label htmlFor="admin-user-password">
              {t('admin.users.password')}
            </TRField.Label>
            <TRInput
              id="admin-user-password"
              name="password"
              required
              type="password"
              uiSize="sm"
            />
          </TRField.Root>
        ) : null}
        <TRField.Root>
          <TRField.Label htmlFor="admin-user-role">
            {t('admin.users.role')}
          </TRField.Label>
          <select
            className="h-9 w-full rounded-tinyrack-sm border border-tinyrack-control-border bg-tinyrack-surface px-3 text-tinyrack-sm text-tinyrack-text focus:border-tinyrack-focus focus:outline-hidden"
            defaultValue={defaultValues?.role ?? 'user'}
            id="admin-user-role"
            name="role"
          >
            <option value="user">{t('admin.users.roleUser')}</option>
            <option value="admin">{t('admin.users.roleAdmin')}</option>
          </select>
        </TRField.Root>
        <label className="flex cursor-pointer items-center justify-start gap-3 rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface px-3 py-2">
          <input
            className="size-4 rounded-tinyrack-xs border-tinyrack-control-border accent-tinyrack-primary"
            defaultChecked={defaultValues?.email_verified ?? false}
            name="email_verified"
            type="checkbox"
          />
          <span className="text-tinyrack-sm text-tinyrack-text-muted">
            {t('admin.users.emailVerified')}
          </span>
        </label>
        <ModalActions>
          <TRButton
            disabled={isMutating}
            onClick={onClose}
            type="button"
            uiSize="sm"
          >
            {t('admin.users.cancel')}
          </TRButton>
          <TRButton
            disabled={isMutating}
            intent="primary"
            type="submit"
            uiSize="sm"
          >
            {submit}
          </TRButton>
        </ModalActions>
      </form>
    </Modal>
  );
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
    <TRButton
      appearance={active ? 'solid' : 'ghost'}
      intent={active ? 'primary' : undefined}
      onClick={onClick}
      type="button"
      uiSize="sm"
    >
      {label}
    </TRButton>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  const { t } = useTranslation();
  return (
    <AdminStat
      hint={t('admin.users.currentPage')}
      label={label}
      value={value}
    />
  );
}
