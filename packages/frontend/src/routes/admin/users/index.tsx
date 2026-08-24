import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminGateScreen } from '#frontend/features/admin/admin-gate-screen.tsx';
import { AdminShell } from '#frontend/features/admin/admin-shell.tsx';
import { AdminUserFormModal } from '#frontend/features/admin/users/admin-user-form-modal.tsx';
import { AdminUsersFilterBar } from '#frontend/features/admin/users/admin-users-filter-bar.tsx';
import {
  getActiveQuickFilter,
  type NoticeState,
  type QuickFilter,
  type UserModalState,
} from '#frontend/features/admin/users/admin-users-filters.ts';
import { AdminUsersNotice } from '#frontend/features/admin/users/admin-users-notice.tsx';
import { AdminUsersSummary } from '#frontend/features/admin/users/admin-users-summary.tsx';
import { AdminUsersTable } from '#frontend/features/admin/users/admin-users-table.tsx';
import { AdminUsersToolbar } from '#frontend/features/admin/users/admin-users-toolbar.tsx';
import {
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

  const noticeOn = (message: string) => setNotice({ tone: 'success', message });
  const noticeFail = () =>
    setNotice({ tone: 'error', message: t('admin.users.operationFailed') });

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: ({ user: nextUser }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      noticeOn(t('admin.users.createdNotice', { email: nextUser.email }));
      setModal(null);
    },
    onError: noticeFail,
  });

  const updateMutation = useMutation({
    mutationFn: updateAdminUser,
    onSuccess: ({ user: nextUser }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      noticeOn(t('admin.users.updatedNotice', { email: nextUser.email }));
      setModal(null);
    },
    onError: noticeFail,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: ({ user: nextUser }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      noticeOn(t('admin.users.deletedNotice', { email: nextUser.email }));
      setModal(null);
    },
    onError: noticeFail,
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
      <AdminUsersSummary
        active={activeUsers}
        config={configUsers}
        database={databaseUsers}
      />

      {notice ? (
        <AdminUsersNotice notice={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <TRCard.Root
        className="overflow-hidden shadow-tinyrack-raised"
        data-testid="admin-users-directory"
        variant="outlined"
      >
        <TRCard.Content className="gap-tinyrack-lg p-0">
          <AdminUsersToolbar
            activeQuickFilter={activeQuickFilter}
            draftIncludeDeleted={draftIncludeDeleted}
            draftQuery={draftQuery}
            onCreate={() => setModal({ type: 'create' })}
            onDraftIncludeDeletedChange={setDraftIncludeDeleted}
            onDraftQueryChange={setDraftQuery}
            onQuickFilter={applyQuickFilter}
            onSearch={applySearch}
            total={data.pagination.total}
          />

          <AdminUsersFilterBar
            activeQuickFilter={activeQuickFilter}
            hasActiveFilters={hasActiveFilters}
            includeDeleted={filters.includeDeleted}
            onClearFilters={clearFilters}
            onPageSizeChange={(pageSize) =>
              setFilters((current) => ({ ...current, page: 1, pageSize }))
            }
            pageEnd={pageEnd}
            pageSize={filters.pageSize}
            pageStart={pageStart}
            query={filters.query}
            total={data.pagination.total}
          />

          <AdminUsersTable
            onDelete={(managedUser) =>
              setModal({ type: 'delete', user: managedUser })
            }
            onEdit={(managedUser) =>
              setModal({ type: 'edit', user: managedUser })
            }
            users={data.users}
          />

          <div className="flex items-center justify-between border-tinyrack-border border-t-tinyrack-default bg-tinyrack-surface-muted p-tinyrack-lg">
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
            <TRBadge uiSize="md">
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

      <AdminUserFormModal
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
