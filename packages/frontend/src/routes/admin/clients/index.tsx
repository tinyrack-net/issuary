import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCheckbox } from '@tinyrack/ui/components/checkbox';
import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import { TRSelect } from '@tinyrack/ui/components/select';
import { TRTable } from '@tinyrack/ui/components/table';
import { TRText } from '@tinyrack/ui/components/text';
import { type FormEvent, useState } from 'react';
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
import { useAdminSelection } from '#frontend/features/admin/use-admin-selection.ts';
import {
  type AdminClient,
  type AdminClientBulkTarget,
  type AdminClientInput,
  type AdminClientsQuery,
  adminClientsQueryOptions,
  bulkSetAdminClientsActive,
  createAdminClient,
  rotateAdminClientSecret,
  updateAdminClient,
} from '#frontend/queries/admin-console.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { SessionUser } from '#frontend/queries/session.ts';

export const Route = createFileRoute('/admin/clients/')({
  component: AdminClientsPage,
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: '/login' });
  },
});

function AdminClientsPage() {
  const user = Route.useRouteContext({ select: (context) => context.user });
  if (user?.role !== 'admin')
    return <AdminGateScreen reason="access-required" />;
  return <AdminClientsGate user={user} />;
}

function AdminClientsGate({ user }: { user: SessionUser }) {
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  if (!config.admin.enabled)
    return <AdminGateScreen reason="console-disabled" />;
  return <AdminClientsContent user={user} />;
}

function AdminClientsContent({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draftQuery, setDraftQuery] = useState('');
  const [filters, setFilters] = useState<AdminClientsQuery>({
    page: 1,
    pageSize: 20,
  });
  const [editing, setEditing] = useState<AdminClient | 'create' | null>(null);
  const [bulkActive, setBulkActive] = useState<boolean | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const { data } = useSuspenseQuery(adminClientsQueryOptions(filters));
  const selection = useAdminSelection(data.clients.map((client) => client.id));
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin'] });
  const createMutation = useMutation({
    mutationFn: createAdminClient,
    onSuccess: (result) => {
      void invalidate();
      setEditing(null);
      setSecret(result.client_secret ?? null);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Omit<AdminClientInput, 'client_id' | 'type'>;
    }) => updateAdminClient(id, input),
    onSuccess: () => {
      void invalidate();
      setEditing(null);
    },
  });
  const rotateMutation = useMutation({
    mutationFn: rotateAdminClientSecret,
    onSuccess: (result) => {
      void invalidate();
      setSecret(result.client_secret);
    },
  });
  const bulkMutation = useMutation({
    mutationFn: bulkSetAdminClientsActive,
    onSuccess: () => {
      void invalidate();
      selection.clear();
      setBulkActive(null);
    },
  });
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const selected =
    selection.selection.kind === 'filter'
      ? data.pagination.total
      : (selection.selectedCount ?? 0);
  const target: AdminClientBulkTarget =
    selection.selection.kind === 'filter'
      ? {
          kind: 'filter',
          filter: {
            query: filters.query,
            managed_by: filters.managedBy,
            enabled: filters.enabled,
          },
        }
      : { kind: 'ids', ids: [...selection.selection.ids] };
  const setFilter = (next: AdminClientsQuery) => {
    selection.clear();
    setFilters(next);
  };

  return (
    <AdminShell current="clients" title={t('admin.clients.title')} user={user}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminListToolbar
          onCreate={() => setEditing('create')}
          onQueryChange={setDraftQuery}
          onSearch={() =>
            setFilter({ ...filters, query: draftQuery.trim(), page: 1 })
          }
          query={draftQuery}
          title={t('admin.clients.title')}
          total={data.pagination.total}
        >
          <AdminFilterSelect
            label={t('admin.clients.type')}
            onChange={(value) =>
              setFilter({
                ...filters,
                type:
                  value === 'public'
                    ? 'public'
                    : value === 'confidential'
                      ? 'confidential'
                      : undefined,
                page: 1,
              })
            }
            options={[
              ['all', t('admin.filter.allTypes')],
              ['public', t('admin.clients.public')],
              ['confidential', t('admin.clients.confidential')],
            ]}
            value={filters.type ?? 'all'}
          />
          <AdminFilterSelect
            label={t('admin.table.status')}
            onChange={(value) =>
              setFilter({
                ...filters,
                enabled: value === 'all' ? undefined : value === 'active',
                page: 1,
              })
            }
            options={[
              ['all', t('admin.filter.allStatuses')],
              ['active', t('admin.status.active')],
              ['inactive', t('admin.status.inactive')],
            ]}
            value={
              filters.enabled === undefined
                ? 'all'
                : filters.enabled
                  ? 'active'
                  : 'inactive'
            }
          />
        </AdminListToolbar>
        <AdminTableFrame>
          <AdminTable label={t('admin.clients.title')}>
            <TRTable.Header className="sticky top-0 z-tinyrack-raised">
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
                    direction={filters.direction ?? 'asc'}
                    label={t('admin.clients.name')}
                    onClick={() =>
                      setFilter({
                        ...filters,
                        direction:
                          filters.direction === 'desc' ? 'asc' : 'desc',
                        page: 1,
                      })
                    }
                  />
                </AdminStickyIdentityCell>
                <TRTable.Head>{t('admin.clients.clientId')}</TRTable.Head>
                <TRTable.Head>{t('admin.clients.type')}</TRTable.Head>
                <TRTable.Head>{t('admin.clients.source')}</TRTable.Head>
                <TRTable.Head>{t('admin.table.status')}</TRTable.Head>
                <TRTable.Head>{t('admin.clients.redirects')}</TRTable.Head>
                <TRTable.Head>{t('admin.clients.scopes')}</TRTable.Head>
                <AdminStickyActionCell header>
                  {t('admin.table.actions')}
                </AdminStickyActionCell>
              </TRTable.Row>
            </TRTable.Header>
            <TRTable.Body>
              {data.clients.length === 0 ? (
                <TRTable.Row>
                  <TRTable.Cell
                    className="py-tinyrack-3xl text-center"
                    colSpan={9}
                  >
                    {t('admin.table.empty')}
                  </TRTable.Cell>
                </TRTable.Row>
              ) : (
                data.clients.map((client) => (
                  <TRTable.Row
                    className={
                      selection.isSelected(client.id)
                        ? 'bg-tinyrack-surface-selected'
                        : undefined
                    }
                    data-selected={
                      selection.isSelected(client.id) ? '' : undefined
                    }
                    key={client.id}
                  >
                    <AdminStickySelectCell
                      selected={selection.isSelected(client.id)}
                    >
                      <AdminRowCheckbox
                        checked={selection.isSelected(client.id)}
                        label={t('admin.selection.row', { name: client.name })}
                        onChange={(checked) =>
                          selection.toggleOne(client.id, checked)
                        }
                      />
                    </AdminStickySelectCell>
                    <AdminStickyIdentityCell
                      selected={selection.isSelected(client.id)}
                    >
                      <TRText as="p" truncate variant="bodySm" weight="medium">
                        {client.name}
                      </TRText>
                    </AdminStickyIdentityCell>
                    <TRTable.Cell>
                      <span className="font-tinyrack-mono text-tinyrack-xs">
                        {client.client_id}
                      </span>
                    </TRTable.Cell>
                    <TRTable.Cell>
                      {t(`admin.clients.${client.type}`)}
                    </TRTable.Cell>
                    <TRTable.Cell>
                      {t(`admin.source.${client.managed_by}`)}
                    </TRTable.Cell>
                    <TRTable.Cell>
                      <TRBadge
                        className="whitespace-nowrap"
                        variant={client.enabled ? 'success' : 'neutral'}
                      >
                        {t(
                          client.enabled
                            ? 'admin.status.active'
                            : 'admin.status.inactive',
                        )}
                      </TRBadge>
                    </TRTable.Cell>
                    <TRTable.Cell>{client.redirect_uris.length}</TRTable.Cell>
                    <TRTable.Cell>{client.scopes.join(', ')}</TRTable.Cell>
                    <AdminStickyActionCell
                      selected={selection.isSelected(client.id)}
                    >
                      <div className="flex justify-end gap-tinyrack-xs">
                        <TRButton
                          appearance="ghost"
                          disabled={client.managed_by === 'config'}
                          onClick={() => setEditing(client)}
                          type="button"
                          uiSize="sm"
                        >
                          {t('admin.actions.edit')}
                        </TRButton>
                        {client.type === 'confidential' ? (
                          <TRButton
                            appearance="ghost"
                            disabled={client.managed_by === 'config'}
                            onClick={() => rotateMutation.mutate(client.id)}
                            type="button"
                            uiSize="sm"
                          >
                            {t('admin.clients.rotateSecret')}
                          </TRButton>
                        ) : null}
                        <TRButton
                          appearance="ghost"
                          disabled={client.managed_by === 'config'}
                          onClick={() =>
                            bulkMutation.mutate({
                              target: { kind: 'ids', ids: [client.id] },
                              active: !client.enabled,
                            })
                          }
                          type="button"
                          uiSize="sm"
                        >
                          {t(
                            client.enabled
                              ? 'admin.actions.deactivate'
                              : 'admin.actions.restore',
                          )}
                        </TRButton>
                      </div>
                    </AdminStickyActionCell>
                  </TRTable.Row>
                ))
              )}
            </TRTable.Body>
          </AdminTable>
          <AdminPagination
            onPageChange={(next) => setFilter({ ...filters, page: next })}
            onPageSizeChange={(next) =>
              setFilter({ ...filters, page: 1, pageSize: next })
            }
            page={page}
            pageSize={pageSize}
            total={data.pagination.total}
          />
        </AdminTableFrame>
      </div>
      {selected > 0 ? (
        <AdminBulkBar
          canExpand={
            selection.allOnPage && data.pagination.total > data.clients.length
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
      <BulkConfirm
        active={bulkActive}
        count={selected}
        filterSelected={selection.selection.kind === 'filter'}
        onClose={() => setBulkActive(null)}
        onRun={() =>
          bulkMutation.mutate({ target, active: bulkActive ?? true })
        }
      />
      <ClientModal
        client={editing === 'create' ? undefined : (editing ?? undefined)}
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        onSubmit={(input) => {
          if (editing && editing !== 'create') {
            const {
              client_id: ignoredClientId,
              type: ignoredType,
              ...update
            } = input;
            void ignoredClientId;
            void ignoredType;
            updateMutation.mutate({ id: editing.id, input: update });
          } else createMutation.mutate(input);
        }}
        pending={createMutation.isPending || updateMutation.isPending}
      />
      <Modal
        description={t('admin.clients.secretDescription')}
        isOpen={secret !== null}
        onClose={() => setSecret(null)}
        title={t('admin.clients.secretTitle')}
      >
        <div className="flex flex-col gap-tinyrack-md pt-tinyrack-lg">
          <code className="break-all rounded-tinyrack-md bg-tinyrack-surface-muted p-tinyrack-md font-tinyrack-mono text-tinyrack-xs">
            {secret}
          </code>
          <TRText color="warning" variant="bodySm">
            {t('admin.clients.secretWarning')}
          </TRText>
          <ModalActions>
            <TRButton onClick={() => setSecret(null)} type="button">
              {t('common.dismiss')}
            </TRButton>
          </ModalActions>
        </div>
      </Modal>
    </AdminShell>
  );
}

function stringValue(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}
function listValue(data: FormData, name: string) {
  return stringValue(data, name)
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function ClientModal({
  isOpen,
  client,
  pending,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  client?: AdminClient | undefined;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: AdminClientInput) => void;
}) {
  const { t } = useTranslation();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const type = stringValue(data, 'type');
    onSubmit({
      client_id: stringValue(data, 'client_id'),
      name: stringValue(data, 'name'),
      type: type === 'confidential' ? 'confidential' : 'public',
      redirect_uris: listValue(data, 'redirect_uris'),
      post_logout_redirect_uris: listValue(data, 'post_logout_redirect_uris'),
      web_origins: listValue(data, 'web_origins'),
      grant_types: listValue(data, 'grant_types'),
      response_types: listValue(data, 'response_types'),
      scopes: listValue(data, 'scopes'),
      skip_consent: data.get('skip_consent') === 'on',
    });
  };
  return (
    <Modal
      description={t(
        client
          ? 'admin.clients.editDescription'
          : 'admin.clients.createDescription',
      )}
      isOpen={isOpen}
      onClose={onClose}
      title={t(
        client ? 'admin.clients.editTitle' : 'admin.clients.createTitle',
      )}
    >
      <form
        className="grid gap-tinyrack-md pt-tinyrack-lg sm:grid-cols-2"
        onSubmit={submit}
      >
        <ClientField
          defaultValue={client?.client_id}
          disabled={Boolean(client)}
          label={t('admin.clients.clientId')}
          name="client_id"
          required
        />
        <ClientField
          defaultValue={client?.name}
          label={t('admin.clients.name')}
          name="name"
          required
        />
        <FormSelect
          defaultValue={client?.type ?? 'public'}
          disabled={Boolean(client)}
          label={t('admin.clients.type')}
          name="type"
          options={[
            ['public', t('admin.clients.public')],
            ['confidential', t('admin.clients.confidential')],
          ]}
        />
        <ClientField
          defaultValue={client?.scopes.join(', ')}
          label={t('admin.clients.scopes')}
          name="scopes"
          required
        />
        <ClientField
          defaultValue={client?.redirect_uris.join('\n')}
          label={t('admin.clients.redirectUris')}
          name="redirect_uris"
          required
        />
        <ClientField
          defaultValue={client?.post_logout_redirect_uris.join('\n')}
          label={t('admin.clients.postLogoutUris')}
          name="post_logout_redirect_uris"
        />
        <ClientField
          defaultValue={client?.web_origins.join('\n')}
          label={t('admin.clients.webOrigins')}
          name="web_origins"
        />
        <ClientField
          defaultValue={client?.grant_types.join(', ') ?? 'authorization_code'}
          label={t('admin.clients.grantTypes')}
          name="grant_types"
          required
        />
        <ClientField
          defaultValue={client?.response_types.join(', ') ?? 'code'}
          label={t('admin.clients.responseTypes')}
          name="response_types"
          required
        />
        <div className="flex items-center gap-tinyrack-sm text-tinyrack-xs">
          <TRCheckbox.Root
            aria-label={t('admin.clients.skipConsent')}
            defaultChecked={client?.skip_consent}
            name="skip_consent"
            value="on"
          >
            <TRCheckbox.Indicator />
          </TRCheckbox.Root>
          {t('admin.clients.skipConsent')}
        </div>
        <ModalActions>
          <TRButton disabled={pending} onClick={onClose} type="button">
            {t('common.dismiss')}
          </TRButton>
          <TRButton disabled={pending} intent="primary" type="submit">
            {t('admin.actions.save')}
          </TRButton>
        </ModalActions>
      </form>
    </Modal>
  );
}

function ClientField({
  label,
  name,
  defaultValue,
  disabled,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
}) {
  return (
    <TRField.Root>
      <TRField.Label>{label}</TRField.Label>
      <TRInput
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        required={required}
        uiSize="sm"
      />
    </TRField.Root>
  );
}
function FormSelect({
  label,
  name,
  defaultValue,
  disabled,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  disabled?: boolean | undefined;
  options: Array<[string, string]>;
}) {
  return (
    <div className="flex flex-col gap-tinyrack-xs text-tinyrack-xs">
      <span>{label}</span>
      <TRSelect.Root
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
      >
        <TRSelect.Trigger aria-label={label} uiSize="sm">
          <TRSelect.Value>
            {options.find(([value]) => value === defaultValue)?.[1] ??
              defaultValue}
          </TRSelect.Value>
        </TRSelect.Trigger>
        <TRSelect.Positioner>
          <TRSelect.Popup>
            <TRSelect.List>
              {options.map(([value, text]) => (
                <TRSelect.Item key={value} value={value}>
                  <TRSelect.ItemText>{text}</TRSelect.ItemText>
                </TRSelect.Item>
              ))}
            </TRSelect.List>
          </TRSelect.Popup>
        </TRSelect.Positioner>
      </TRSelect.Root>
    </div>
  );
}

function BulkConfirm({
  active,
  count,
  filterSelected,
  onClose,
  onRun,
}: {
  active: boolean | null;
  count: number;
  filterSelected: boolean;
  onClose: () => void;
  onRun: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen={active !== null}
      onClose={onClose}
      title={t(
        active ? 'admin.bulk.activateTitle' : 'admin.bulk.deactivateTitle',
      )}
    >
      <div className="pt-tinyrack-lg">
        <TRText color="muted" variant="bodySm">
          {t('admin.bulk.confirm', {
            count,
            scope: t(
              filterSelected
                ? 'admin.selection.filterScope'
                : 'admin.selection.pageScope',
            ),
          })}
        </TRText>
        <ModalActions>
          <TRButton onClick={onClose} type="button">
            {t('common.dismiss')}
          </TRButton>
          <TRButton
            intent={active ? 'primary' : 'danger'}
            onClick={onRun}
            type="button"
          >
            {t('admin.bulk.run')}
          </TRButton>
        </ModalActions>
      </div>
    </Modal>
  );
}
