import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRTable } from '@tinyrack/ui/components/table';
import { TRText } from '@tinyrack/ui/components/text';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import {
  AdminBulkBar,
  AdminFilterSelect,
  AdminListToolbar,
  AdminPagination,
  AdminRowCheckbox,
  AdminSelectAll,
  AdminSortButton,
  AdminStickyActionCell,
  AdminStickyIdentityCell,
  AdminStickySelectCell,
  AdminTable,
  AdminTableFrame,
} from '#frontend/features/admin/admin-data-table.tsx';
import { AdminGateScreen } from '#frontend/features/admin/admin-gate-screen.tsx';
import { AdminShell } from '#frontend/features/admin/admin-shell.tsx';
import {
  formatAdminRole,
  formatManagedBy,
} from '#frontend/features/admin/format-admin-user.ts';
import { useAdminSelection } from '#frontend/features/admin/use-admin-selection.ts';
import { AdminUserFormModal } from '#frontend/features/admin/users/admin-user-form-modal.tsx';
import type {
  NoticeState,
  UserModalState,
} from '#frontend/features/admin/users/admin-users-filters.ts';
import { AdminUsersNotice } from '#frontend/features/admin/users/admin-users-notice.tsx';
import {
  type AdminBulkTarget,
  adminUsersQueryOptions,
  bulkSetAdminUsersActive,
  createAdminUser,
  deleteAdminUser,
  normalizeAdminUsersQuery,
  restoreAdminUser,
  updateAdminUser,
} from '#frontend/queries/admin-users.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { SessionUser } from '#frontend/queries/session.ts';

export const Route = createFileRoute('/admin/users/')({
  component: AdminUsersPage,
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: '/login' });
  },
});

function AdminUsersPage() {
  const user = Route.useRouteContext({ select: (context) => context.user });
  if (user?.role !== 'admin')
    return <AdminGateScreen reason="access-required" />;
  return <AdminUsersGate user={user} />;
}

function AdminUsersGate({ user }: { user: SessionUser }) {
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  if (!config.admin.enabled)
    return <AdminGateScreen reason="console-disabled" />;
  return <AdminUsersContent user={user} />;
}

function AdminUsersContent({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draftQuery, setDraftQuery] = useState('');
  const [filters, setFilters] = useState(() => normalizeAdminUsersQuery());
  const [notice, setNotice] = useState<NoticeState>(null);
  const [modal, setModal] = useState<UserModalState>(null);
  const [bulkActive, setBulkActive] = useState<boolean | null>(null);
  const { data } = useSuspenseQuery(adminUsersQueryOptions(filters));
  const selection = useAdminSelection(
    data.users.map((managedUser) => managedUser.sub),
  );
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin'] });
  const noticeFail = () =>
    setNotice({ tone: 'error', message: t('admin.users.operationFailed') });
  const noticeOn = (message: string) => setNotice({ tone: 'success', message });

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: ({ user: next }) => {
      void invalidate();
      noticeOn(t('admin.users.createdNotice', { email: next.email }));
      setModal(null);
    },
    onError: noticeFail,
  });
  const updateMutation = useMutation({
    mutationFn: updateAdminUser,
    onSuccess: ({ user: next }) => {
      void invalidate();
      noticeOn(t('admin.users.updatedNotice', { email: next.email }));
      setModal(null);
    },
    onError: noticeFail,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: ({ user: next }) => {
      void invalidate();
      noticeOn(t('admin.users.deletedNotice', { email: next.email }));
      setModal(null);
    },
    onError: noticeFail,
  });
  const restoreMutation = useMutation({
    mutationFn: restoreAdminUser,
    onSuccess: ({ user: next }) => {
      void invalidate();
      noticeOn(t('admin.users.restoredNotice', { email: next.email }));
    },
    onError: noticeFail,
  });
  const bulkMutation = useMutation({
    mutationFn: bulkSetAdminUsersActive,
    onSuccess: (result) => {
      void invalidate();
      selection.clear();
      setBulkActive(null);
      noticeOn(t('admin.selection.result', result));
    },
    onError: noticeFail,
  });

  const resetSelectionAndSet = (next: typeof filters) => {
    selection.clear();
    setFilters(next);
  };
  const applySearch = () =>
    resetSelectionAndSet({ ...filters, query: draftQuery.trim(), page: 1 });
  const target: AdminBulkTarget =
    selection.selection.kind === 'filter'
      ? {
          kind: 'filter',
          filter: {
            query: filters.query || undefined,
            include_deleted: filters.includeDeleted,
            managed_by: filters.managedBy,
            role: filters.role,
            email_verified: filters.emailVerified,
          },
        }
      : { kind: 'ids', ids: [...selection.selection.ids] };
  const selected =
    selection.selection.kind === 'filter'
      ? data.pagination.total
      : (selection.selectedCount ?? 0);
  const mutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <AdminShell current="users" title={t('admin.users.title')} user={user}>
      {notice ? (
        <AdminUsersNotice notice={notice} onDismiss={() => setNotice(null)} />
      ) : null}
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        data-testid="admin-users-directory"
      >
        <AdminListToolbar
          onCreate={() => setModal({ type: 'create' })}
          onQueryChange={setDraftQuery}
          onSearch={applySearch}
          query={draftQuery}
          title={t('admin.users.title')}
          total={data.pagination.total}
        >
          <AdminFilterSelect
            label={t('admin.users.managedBy')}
            onChange={(value) =>
              resetSelectionAndSet({
                ...filters,
                managedBy:
                  value === 'database'
                    ? 'database'
                    : value === 'config'
                      ? 'config'
                      : undefined,
                page: 1,
              })
            }
            options={[
              ['all', t('admin.filter.allSources')],
              ['database', t('admin.source.database')],
              ['config', t('admin.source.config')],
            ]}
            value={filters.managedBy ?? 'all'}
          />
          <AdminFilterSelect
            label={t('admin.users.role')}
            onChange={(value) =>
              resetSelectionAndSet({
                ...filters,
                role:
                  value === 'user'
                    ? 'user'
                    : value === 'admin'
                      ? 'admin'
                      : undefined,
                page: 1,
              })
            }
            options={[
              ['all', t('admin.filter.allRoles')],
              ['user', t('admin.users.roleUser')],
              ['admin', t('admin.users.roleAdmin')],
            ]}
            value={filters.role ?? 'all'}
          />
          <AdminFilterSelect
            label={t('admin.table.status')}
            onChange={(value) =>
              resetSelectionAndSet({
                ...filters,
                includeDeleted: value === 'all',
                page: 1,
              })
            }
            options={[
              ['active', t('admin.status.active')],
              ['all', t('admin.filter.includeInactive')],
            ]}
            value={filters.includeDeleted ? 'all' : 'active'}
          />
        </AdminListToolbar>
        <AdminTableFrame>
          <AdminTable label={t('admin.users.title')}>
            <TRTable.Header className="sticky top-0 z-tinyrack-component-raised">
              <TRTable.Row>
                <AdminStickySelectCell header>
                  <AdminSelectAll
                    checked={selection.allOnPage}
                    indeterminate={selection.someOnPage}
                    onChange={selection.togglePage}
                  />
                </AdminStickySelectCell>
                <AdminStickyIdentityCell header>
                  <AdminSortButton
                    direction={
                      filters.sort === 'email' ? filters.direction : undefined
                    }
                    label={t('admin.users.email')}
                    onClick={() =>
                      resetSelectionAndSet({
                        ...filters,
                        sort: 'email',
                        direction:
                          filters.sort === 'email' &&
                          filters.direction === 'asc'
                            ? 'desc'
                            : 'asc',
                        page: 1,
                      })
                    }
                  />
                </AdminStickyIdentityCell>
                <TRTable.Head>
                  <AdminSortButton
                    direction={
                      filters.sort === 'role' ? filters.direction : undefined
                    }
                    label={t('admin.users.role')}
                    onClick={() =>
                      resetSelectionAndSet({
                        ...filters,
                        sort: 'role',
                        direction:
                          filters.sort === 'role' && filters.direction === 'asc'
                            ? 'desc'
                            : 'asc',
                        page: 1,
                      })
                    }
                  />
                </TRTable.Head>
                <TRTable.Head>{t('admin.users.managedBy')}</TRTable.Head>
                <TRTable.Head>{t('admin.users.emailVerified')}</TRTable.Head>
                <TRTable.Head>{t('admin.users.twoFactor')}</TRTable.Head>
                <TRTable.Head>{t('admin.table.status')}</TRTable.Head>
                <TRTable.Head>{t('admin.users.sub')}</TRTable.Head>
                <AdminStickyActionCell header>
                  {t('admin.table.actions')}
                </AdminStickyActionCell>
              </TRTable.Row>
            </TRTable.Header>
            <TRTable.Body>
              {data.users.length === 0 ? (
                <TRTable.Row>
                  <TRTable.Cell
                    className="py-tinyrack-3xl text-center"
                    colSpan={9}
                  >
                    {t('admin.table.empty')}
                  </TRTable.Cell>
                </TRTable.Row>
              ) : (
                data.users.map((managedUser) => (
                  <TRTable.Row
                    className={
                      selection.isSelected(managedUser.sub)
                        ? 'bg-tinyrack-surface-selected'
                        : undefined
                    }
                    data-selected={
                      selection.isSelected(managedUser.sub) ? '' : undefined
                    }
                    key={managedUser.sub}
                  >
                    <AdminStickySelectCell
                      selected={selection.isSelected(managedUser.sub)}
                    >
                      <AdminRowCheckbox
                        checked={selection.isSelected(managedUser.sub)}
                        label={t('admin.selection.row', {
                          name: managedUser.email,
                        })}
                        onChange={(checked) =>
                          selection.toggleOne(managedUser.sub, checked)
                        }
                      />
                    </AdminStickySelectCell>
                    <AdminStickyIdentityCell
                      selected={selection.isSelected(managedUser.sub)}
                    >
                      <TRText as="p" truncate variant="bodySm" weight="medium">
                        {managedUser.email}
                      </TRText>
                    </AdminStickyIdentityCell>
                    <TRTable.Cell>
                      <TRBadge
                        variant={
                          managedUser.role === 'admin' ? 'info' : 'neutral'
                        }
                      >
                        {formatAdminRole(t, managedUser.role)}
                      </TRBadge>
                    </TRTable.Cell>
                    <TRTable.Cell>
                      {formatManagedBy(t, managedUser.managed_by)}
                    </TRTable.Cell>
                    <TRTable.Cell>
                      {t(
                        managedUser.email_verified ? 'common.yes' : 'common.no',
                      )}
                    </TRTable.Cell>
                    <TRTable.Cell>
                      {t(
                        managedUser.totp_registered ||
                          managedUser.passkey_count > 0
                          ? 'common.yes'
                          : 'common.no',
                      )}
                    </TRTable.Cell>
                    <TRTable.Cell>
                      <TRBadge
                        className="whitespace-nowrap"
                        variant={managedUser.deleted_at ? 'neutral' : 'success'}
                      >
                        {t(
                          managedUser.deleted_at
                            ? 'admin.status.inactive'
                            : 'admin.status.active',
                        )}
                      </TRBadge>
                    </TRTable.Cell>
                    <TRTable.Cell>
                      <TRText as="span" variant="code">
                        {managedUser.sub}
                      </TRText>
                    </TRTable.Cell>
                    <AdminStickyActionCell
                      selected={selection.isSelected(managedUser.sub)}
                    >
                      {managedUser.deleted_at ? (
                        <TRButton
                          disabled={managedUser.managed_by === 'config'}
                          onClick={() =>
                            restoreMutation.mutate(managedUser.sub)
                          }
                          type="button"
                          uiSize="sm"
                        >
                          {t('admin.actions.restore')}
                        </TRButton>
                      ) : (
                        <div className="flex justify-end gap-tinyrack-xs">
                          <TRButton
                            appearance="ghost"
                            disabled={managedUser.managed_by === 'config'}
                            onClick={() =>
                              setModal({ type: 'edit', user: managedUser })
                            }
                            type="button"
                            uiSize="sm"
                          >
                            {t('admin.actions.edit')}
                          </TRButton>
                          <TRButton
                            appearance="ghost"
                            disabled={
                              managedUser.managed_by === 'config' ||
                              managedUser.sub === user.sub
                            }
                            onClick={() =>
                              setModal({ type: 'delete', user: managedUser })
                            }
                            type="button"
                            uiSize="sm"
                          >
                            {t('admin.actions.deactivate')}
                          </TRButton>
                        </div>
                      )}
                    </AdminStickyActionCell>
                  </TRTable.Row>
                ))
              )}
            </TRTable.Body>
          </AdminTable>
          <AdminPagination
            onPageChange={(page) => {
              selection.clear();
              setFilters({ ...filters, page });
            }}
            onPageSizeChange={(pageSize) =>
              resetSelectionAndSet({ ...filters, page: 1, pageSize })
            }
            page={filters.page}
            pageSize={filters.pageSize}
            total={data.pagination.total}
          />
        </AdminTableFrame>
      </div>
      {selected > 0 ? (
        <AdminBulkBar
          canExpand={
            selection.allOnPage && data.pagination.total > data.users.length
          }
          filterSelected={selection.selection.kind === 'filter'}
          onActivate={() => setBulkActive(true)}
          onClear={selection.clear}
          onDeactivate={() => setBulkActive(false)}
          onExpand={selection.selectFilter}
          pending={bulkMutation.isPending}
          selected={selected}
          total={data.pagination.total}
        />
      ) : null}
      <Modal
        isOpen={bulkActive !== null}
        onClose={() => setBulkActive(null)}
        title={t(
          bulkActive
            ? 'admin.bulk.activateTitle'
            : 'admin.bulk.deactivateTitle',
        )}
      >
        <div className="pt-tinyrack-lg">
          <TRText color="muted" variant="bodySm">
            {t('admin.bulk.confirm', {
              count: selected,
              scope: t(
                selection.selection.kind === 'filter'
                  ? 'admin.selection.filterScope'
                  : 'admin.selection.pageScope',
              ),
            })}
          </TRText>
          <ModalActions>
            <TRButton onClick={() => setBulkActive(null)} type="button">
              {t('common.dismiss')}
            </TRButton>
            <TRButton
              intent={bulkActive ? 'primary' : 'danger'}
              onClick={() =>
                bulkMutation.mutate({ target, active: bulkActive ?? true })
              }
              type="button"
            >
              {t('admin.bulk.run')}
            </TRButton>
          </ModalActions>
        </div>
      </Modal>
      <AdminUserFormModal
        isMutating={mutating}
        modal={modal}
        onClose={() => setModal(null)}
        onCreate={(values) => createMutation.mutate(values)}
        onDelete={(sub) => deleteMutation.mutate(sub)}
        onUpdate={(values) => updateMutation.mutate(values)}
      />
    </AdminShell>
  );
}
