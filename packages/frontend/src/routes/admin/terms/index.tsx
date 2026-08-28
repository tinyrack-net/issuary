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
import { TRFieldset } from '@tinyrack/ui/components/fieldset';
import { TRForm } from '@tinyrack/ui/components/form';
import { TRInput } from '@tinyrack/ui/components/input';
import { TRSelect } from '@tinyrack/ui/components/select';
import { TRTable } from '@tinyrack/ui/components/table';
import { TRText } from '@tinyrack/ui/components/text';
import { TRTextarea } from '@tinyrack/ui/components/textarea';
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
  type AdminTerm,
  type AdminTermBulkTarget,
  type AdminTermInput,
  type AdminTermsQuery,
  adminTermsQueryOptions,
  bulkSetAdminTermsActive,
  createAdminTerm,
  updateAdminTerm,
} from '#frontend/queries/admin-console.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { SessionUser } from '#frontend/queries/session.ts';

export const Route = createFileRoute('/admin/terms/')({
  component: AdminTermsPage,
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: '/login' });
  },
});

function AdminTermsPage() {
  const user = Route.useRouteContext({ select: (context) => context.user });
  if (user?.role !== 'admin')
    return <AdminGateScreen reason="access-required" />;
  return <AdminTermsGate user={user} />;
}
function AdminTermsGate({ user }: { user: SessionUser }) {
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  if (!config.admin.enabled)
    return <AdminGateScreen reason="console-disabled" />;
  return <AdminTermsContent user={user} />;
}

function AdminTermsContent({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draftQuery, setDraftQuery] = useState('');
  const [filters, setFilters] = useState<AdminTermsQuery>({
    page: 1,
    pageSize: 20,
  });
  const [editing, setEditing] = useState<AdminTerm | 'create' | null>(null);
  const [bulkActive, setBulkActive] = useState<boolean | null>(null);
  const { data } = useSuspenseQuery(adminTermsQueryOptions(filters));
  const selection = useAdminSelection(data.terms.map((term) => term.id));
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin'] });
  const createMutation = useMutation({
    mutationFn: createAdminTerm,
    onSuccess: () => {
      void invalidate();
      setEditing(null);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Omit<AdminTermInput, 'id'>;
    }) => updateAdminTerm(id, input),
    onSuccess: () => {
      void invalidate();
      setEditing(null);
    },
  });
  const bulkMutation = useMutation({
    mutationFn: bulkSetAdminTermsActive,
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
  const target: AdminTermBulkTarget =
    selection.selection.kind === 'filter'
      ? {
          kind: 'filter',
          filter: {
            query: filters.query,
            managed_by: filters.managedBy,
            archived: filters.archived,
          },
        }
      : { kind: 'ids', ids: [...selection.selection.ids] };
  const setFilter = (next: AdminTermsQuery) => {
    selection.clear();
    setFilters(next);
  };
  return (
    <AdminShell current="terms" title={t('admin.terms.title')} user={user}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminListToolbar
          onCreate={() => setEditing('create')}
          onQueryChange={setDraftQuery}
          onSearch={() =>
            setFilter({ ...filters, query: draftQuery.trim(), page: 1 })
          }
          query={draftQuery}
          title={t('admin.terms.title')}
          total={data.pagination.total}
        >
          <AdminFilterSelect
            label={t('admin.terms.required')}
            onChange={(value) =>
              setFilter({
                ...filters,
                required: value === 'all' ? undefined : value === 'required',
                page: 1,
              })
            }
            options={[
              ['all', t('admin.filter.allRequirements')],
              ['required', t('admin.terms.required')],
              ['optional', t('admin.terms.optional')],
            ]}
            value={
              filters.required === undefined
                ? 'all'
                : filters.required
                  ? 'required'
                  : 'optional'
            }
          />
          <AdminFilterSelect
            label={t('admin.terms.consentMode')}
            onChange={(value) =>
              setFilter({
                ...filters,
                consentMode:
                  value === 'explicit'
                    ? 'explicit'
                    : value === 'implicit'
                      ? 'implicit'
                      : undefined,
                page: 1,
              })
            }
            options={[
              ['all', t('admin.filter.allModes')],
              ['explicit', t('admin.terms.explicit')],
              ['implicit', t('admin.terms.implicit')],
            ]}
            value={filters.consentMode ?? 'all'}
          />
          <AdminFilterSelect
            label={t('admin.table.status')}
            onChange={(value) =>
              setFilter({
                ...filters,
                archived: value === 'all' ? undefined : value === 'archived',
                page: 1,
              })
            }
            options={[
              ['all', t('admin.filter.allStatuses')],
              ['active', t('admin.status.active')],
              ['archived', t('admin.status.archived')],
            ]}
            value={
              filters.archived === undefined
                ? 'all'
                : filters.archived
                  ? 'archived'
                  : 'active'
            }
          />
        </AdminListToolbar>
        <AdminTableFrame>
          <AdminTable label={t('admin.terms.title')}>
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
                    direction={filters.direction ?? 'asc'}
                    label={t('admin.terms.id')}
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
                <TRTable.Head>{t('admin.terms.titleLabel')}</TRTable.Head>
                <TRTable.Head>{t('admin.terms.version')}</TRTable.Head>
                <TRTable.Head>{t('admin.terms.required')}</TRTable.Head>
                <TRTable.Head>{t('admin.terms.consentMode')}</TRTable.Head>
                <TRTable.Head>{t('admin.terms.languages')}</TRTable.Head>
                <TRTable.Head>{t('admin.terms.source')}</TRTable.Head>
                <TRTable.Head>{t('admin.table.status')}</TRTable.Head>
                <AdminStickyActionCell header>
                  {t('admin.table.actions')}
                </AdminStickyActionCell>
              </TRTable.Row>
            </TRTable.Header>
            <TRTable.Body>
              {data.terms.length === 0 ? (
                <TRTable.Row>
                  <TRTable.Cell
                    className="py-tinyrack-3xl text-center"
                    colSpan={10}
                  >
                    {t('admin.table.empty')}
                  </TRTable.Cell>
                </TRTable.Row>
              ) : (
                data.terms.map((term) => (
                  <TRTable.Row
                    className={
                      selection.isSelected(term.id)
                        ? 'bg-tinyrack-surface-selected'
                        : undefined
                    }
                    data-selected={
                      selection.isSelected(term.id) ? '' : undefined
                    }
                    key={term.id}
                  >
                    <AdminStickySelectCell
                      selected={selection.isSelected(term.id)}
                    >
                      <AdminRowCheckbox
                        checked={selection.isSelected(term.id)}
                        label={t('admin.selection.row', { name: term.id })}
                        onChange={(checked) =>
                          selection.toggleOne(term.id, checked)
                        }
                      />
                    </AdminStickySelectCell>
                    <AdminStickyIdentityCell
                      selected={selection.isSelected(term.id)}
                    >
                      <TRText as="span" variant="code">
                        {term.id}
                      </TRText>
                    </AdminStickyIdentityCell>
                    <TRTable.Cell>
                      {term.contents[0]?.title ?? term.id}
                    </TRTable.Cell>
                    <TRTable.Cell>{term.version}</TRTable.Cell>
                    <TRTable.Cell>
                      {t(term.required ? 'common.yes' : 'common.no')}
                    </TRTable.Cell>
                    <TRTable.Cell>
                      {t(`admin.terms.${term.consent_mode}`)}
                    </TRTable.Cell>
                    <TRTable.Cell>
                      {term.contents
                        .map((content) => content.lang.toUpperCase())
                        .join(', ')}
                    </TRTable.Cell>
                    <TRTable.Cell>
                      {t(`admin.source.${term.managed_by}`)}
                    </TRTable.Cell>
                    <TRTable.Cell>
                      <TRBadge
                        className="whitespace-nowrap"
                        variant={term.archived_at ? 'neutral' : 'success'}
                      >
                        {t(
                          term.archived_at
                            ? 'admin.status.archived'
                            : 'admin.status.active',
                        )}
                      </TRBadge>
                    </TRTable.Cell>
                    <AdminStickyActionCell
                      selected={selection.isSelected(term.id)}
                    >
                      <div className="flex justify-end gap-tinyrack-xs">
                        <TRButton
                          appearance="ghost"
                          disabled={term.managed_by === 'config'}
                          onClick={() => setEditing(term)}
                          type="button"
                          uiSize="sm"
                        >
                          {t('admin.actions.edit')}
                        </TRButton>
                        <TRButton
                          appearance="ghost"
                          disabled={term.managed_by === 'config'}
                          onClick={() =>
                            bulkMutation.mutate({
                              target: { kind: 'ids', ids: [term.id] },
                              active: Boolean(term.archived_at),
                            })
                          }
                          type="button"
                          uiSize="sm"
                        >
                          {t(
                            term.archived_at
                              ? 'admin.actions.restore'
                              : 'admin.actions.archive',
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
            selection.allOnPage && data.pagination.total > data.terms.length
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
      <TermsBulkConfirm
        active={bulkActive}
        count={selected}
        filterSelected={selection.selection.kind === 'filter'}
        onClose={() => setBulkActive(null)}
        onRun={() =>
          bulkMutation.mutate({ target, active: bulkActive ?? true })
        }
      />
      <TermModal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        onSubmit={(input) => {
          if (editing && editing !== 'create') {
            const { id: ignoredId, ...update } = input;
            void ignoredId;
            updateMutation.mutate({ id: editing.id, input: update });
          } else createMutation.mutate(input);
        }}
        pending={createMutation.isPending || updateMutation.isPending}
        term={editing === 'create' ? undefined : (editing ?? undefined)}
      />
    </AdminShell>
  );
}

function formString(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}
const TERM_LANGUAGES: Array<'ko' | 'en' | 'ja'> = ['ko', 'en', 'ja'];

function TermModal({
  isOpen,
  term,
  pending,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  term?: AdminTerm | undefined;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: AdminTermInput) => void;
}) {
  const { t } = useTranslation();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const consentMode = formString(data, 'consent_mode');
    const contents: AdminTermInput['contents'] = [];
    for (const lang of TERM_LANGUAGES) {
      const title = formString(data, `${lang}_title`);
      const content = formString(data, `${lang}_content`);
      const contentType = formString(data, `${lang}_type`);
      if (title && content)
        contents.push({
          lang,
          title,
          type: contentType === 'text' ? 'text' : 'link',
          content,
        });
    }
    onSubmit({
      id: formString(data, 'id'),
      required: data.get('required') === 'on',
      consent_mode: consentMode === 'implicit' ? 'implicit' : 'explicit',
      version: formString(data, 'version'),
      contents,
    });
  };
  return (
    <Modal
      description={t(
        term ? 'admin.terms.editDescription' : 'admin.terms.createDescription',
      )}
      isOpen={isOpen}
      onClose={onClose}
      title={t(term ? 'admin.terms.editTitle' : 'admin.terms.createTitle')}
    >
      <TRForm
        className="flex flex-col gap-tinyrack-md pt-tinyrack-lg"
        onSubmit={submit}
      >
        {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural form grid; fields own visible typography. */}
        <div className="grid gap-tinyrack-md sm:grid-cols-2">
          <TermField
            defaultValue={term?.id}
            disabled={Boolean(term)}
            label={t('admin.terms.id')}
            name="id"
          />
          <TermField
            defaultValue={term?.version ?? '1.0.0'}
            label={t('admin.terms.version')}
            name="version"
          />
          <TermFormSelect
            defaultValue={term?.consent_mode ?? 'explicit'}
            label={t('admin.terms.consentMode')}
            name="consent_mode"
            options={[
              ['explicit', t('admin.terms.explicit')],
              ['implicit', t('admin.terms.implicit')],
            ]}
          />
          {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural checkbox row; visible label uses TRText. */}
          <div className="flex items-center gap-tinyrack-sm">
            <TRCheckbox.Root
              aria-label={t('admin.terms.required')}
              defaultChecked={term?.required ?? true}
              name="required"
              value="on"
            >
              <TRCheckbox.Indicator />
            </TRCheckbox.Root>
            <TRText variant="caption">{t('admin.terms.required')}</TRText>
          </div>
        </div>
        {term ? (
          <TRText color="warning" variant="bodySm">
            {t('admin.terms.versionWarning')}
          </TRText>
        ) : null}
        {TERM_LANGUAGES.map((lang) => {
          const content = term?.contents.find((item) => item.lang === lang);
          return (
            <TRFieldset.Root
              className="grid gap-tinyrack-sm pt-tinyrack-md sm:grid-cols-2"
              key={lang}
            >
              <TRFieldset.Legend>{lang.toUpperCase()}</TRFieldset.Legend>
              <TermField
                defaultValue={content?.title}
                label={t('admin.terms.titleLabel')}
                name={`${lang}_title`}
              />
              <TermFormSelect
                defaultValue={content?.type ?? 'link'}
                label={t('admin.terms.contentType')}
                name={`${lang}_type`}
                options={[
                  ['link', t('admin.terms.link')],
                  ['text', t('admin.terms.text')],
                ]}
              />
              <TRTextarea
                className="sm:col-span-2"
                defaultValue={content?.content}
                name={`${lang}_content`}
                placeholder={t('admin.terms.content')}
              />
            </TRFieldset.Root>
          );
        })}
        <ModalActions>
          <TRButton disabled={pending} onClick={onClose} type="button">
            {t('common.dismiss')}
          </TRButton>
          <TRButton disabled={pending} intent="primary" type="submit">
            {t('admin.actions.save')}
          </TRButton>
        </ModalActions>
      </TRForm>
    </Modal>
  );
}
function TermField({
  label,
  name,
  defaultValue,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue?: string | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <TRField.Root>
      <TRField.Label>{label}</TRField.Label>
      <TRInput
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        required
        uiSize="sm"
      />
    </TRField.Root>
  );
}
function TermFormSelect({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
}) {
  return (
    <div className="flex flex-col gap-tinyrack-xs text-tinyrack-xs">
      <TRText as="span" variant="caption">
        {label}
      </TRText>
      <TRSelect.Root defaultValue={defaultValue} name={name}>
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
function TermsBulkConfirm({
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
      title={t(active ? 'admin.bulk.restoreTitle' : 'admin.bulk.archiveTitle')}
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
