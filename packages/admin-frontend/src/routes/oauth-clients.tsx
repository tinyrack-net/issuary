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
  createOAuthClient,
  deleteOAuthClient,
  type OAuthClient,
  updateOAuthClient,
} from '#admin/libs/api.js';
import { oauthClientsQueryOptions } from '#admin/queries/admin.js';
import { queryKeys } from '#admin/queries/keys.js';

type OAuthClientFormState = {
  clientId: string;
  enabled: boolean;
  name: string;
  redirectUris: string;
  scope: string;
};

type ModalState =
  | { mode: 'create'; form: OAuthClientFormState }
  | { mode: 'edit'; client: OAuthClient; form: OAuthClientFormState }
  | { mode: 'delete'; client: OAuthClient }
  | null;

const emptyClientForm: OAuthClientFormState = {
  clientId: '',
  enabled: true,
  name: '',
  redirectUris: '',
  scope: 'openid profile',
};

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function splitWords(value: string): string[] {
  return value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function formFromClient(client: OAuthClient): OAuthClientFormState {
  return {
    clientId: client.client_id,
    enabled: client.enabled,
    name: client.name,
    redirectUris: client.redirect_uris.join('\n'),
    scope: client.scope,
  };
}

function displayNameForClient(client: OAuthClient): string {
  return client.name || client.client_id;
}

export function OAuthClientsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const search = useRouterState({ select: (state) => state.location.search });
  const [params, setParams] = useState(() => parseAdminListSearch(search));
  const [searchInput, setSearchInput] = useState(params.search);
  const { data: clientsResponse } = useSuspenseQuery(
    oauthClientsQueryOptions(params),
  );
  const [modal, setModal] = useState<ModalState>(null);
  const clients = clientsResponse.items;
  const pagination = clientsResponse.pagination;
  const invalidateClients = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.oauthClients(params),
    });
  };
  const createMutation = useMutation({
    mutationFn: createOAuthClient,
    onSuccess: async () => {
      setModal(null);
      await invalidateClients();
    },
  });
  const updateMutation = useMutation({
    mutationFn: updateOAuthClient,
    onSuccess: async () => {
      setModal(null);
      await invalidateClients();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteOAuthClient,
    onSuccess: async () => {
      setModal(null);
      await invalidateClients();
    },
  });
  const formModal = modal && modal.mode !== 'delete' ? modal : null;
  const modalForm = formModal?.form;

  return (
    <section className="space-y-6">
      <PageHeader
        action={
          <button
            className="btn btn-primary w-full sm:w-auto"
            onClick={() => {
              setModal({ mode: 'create', form: emptyClientForm });
            }}
            type="button"
          >
            {t('oauthClients.addClient')}
          </button>
        }
        subtitle={t('oauthClients.subtitle')}
        title={t('oauthClients.title')}
      />

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
                  {t('oauthClients.search')}
                </span>
              </span>
              <div className="md:join flex flex-col gap-2 md:flex-row md:gap-0">
                <input
                  aria-label={t('oauthClients.search')}
                  className="input input-bordered md:join-item w-full min-w-0 md:flex-1"
                  onChange={(event) => {
                    setSearchInput(event.currentTarget.value);
                  }}
                  placeholder={t('oauthClients.searchPlaceholder')}
                  type="search"
                  value={searchInput}
                />
                <button
                  aria-label={t('oauthClients.search')}
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
        ariaLabel={t('oauthClients.tableLabel')}
        columns={[
          { key: 'name', header: t('oauthClients.name') },
          { key: 'clientId', header: t('oauthClients.clientId') },
          { key: 'status', header: t('oauthClients.status') },
          { key: 'source', header: t('oauthClients.source') },
          { key: 'redirectUris', header: t('oauthClients.redirectUris') },
          { key: 'grantTypes', header: t('oauthClients.grantTypes') },
          { key: 'scope', header: t('oauthClients.scope') },
          { key: 'updated', header: t('oauthClients.updated') },
          { key: 'actions', header: t('oauthClients.actions') },
        ]}
        emptyMessage={t('oauthClients.empty')}
        getRowKey={(client) => client.id}
        renderMobileCard={(client) => {
          const displayName = displayNameForClient(client);
          const editable = client.managed_by === 'database';

          return (
            <article className="card card-compact border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="card-title break-words text-base">
                      {displayName}
                    </h2>
                    <p className="break-all font-mono text-base-content/60 text-xs">
                      {client.client_id}
                    </p>
                  </div>
                  <span
                    className={`badge shrink-0 ${client.enabled ? 'badge-success' : 'badge-ghost'}`}
                  >
                    {client.enabled
                      ? t('oauthClients.enabled')
                      : t('oauthClients.disabled')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="badge badge-outline">
                    {client.managed_by === 'config'
                      ? t('oauthClients.readOnlyConfig')
                      : t('oauthClients.databaseManaged')}
                  </span>
                  <span className="badge badge-ghost">
                    {t('oauthClients.redirectUriCount', {
                      count: client.redirect_uris.length,
                    })}
                  </span>
                </div>

                <div className="rounded-box bg-base-200/70 p-3 text-sm">
                  <dl className="grid gap-2">
                    <div className="grid gap-1">
                      <dt className="text-base-content/60">
                        {t('oauthClients.grantTypes')}
                      </dt>
                      <dd className="break-words">
                        {client.grant_types.join(', ') || t('common.unknown')}
                      </dd>
                    </div>
                    <div className="grid gap-1">
                      <dt className="text-base-content/60">
                        {t('oauthClients.scope')}
                      </dt>
                      <dd className="break-all font-mono text-xs">
                        {client.scope}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-base-content/60">
                        {t('oauthClients.updated')}
                      </dt>
                      <dd className="text-right">
                        {client.updated_at ?? t('common.unknown')}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="join w-full">
                  <button
                    className="btn btn-outline join-item btn-sm flex-1"
                    disabled={!editable}
                    onClick={() => {
                      setModal({
                        mode: 'edit',
                        client,
                        form: formFromClient(client),
                      });
                    }}
                    title={
                      editable
                        ? t('oauthClients.editAction')
                        : t('oauthClients.readOnlyAction')
                    }
                    type="button"
                  >
                    {t('oauthClients.editClient', { name: displayName })}
                  </button>
                  <button
                    className="btn btn-error btn-outline join-item btn-sm flex-1"
                    disabled={!editable || deleteMutation.isPending}
                    onClick={() => {
                      setModal({ mode: 'delete', client });
                    }}
                    title={
                      editable
                        ? t('oauthClients.deleteAction')
                        : t('oauthClients.readOnlyAction')
                    }
                    type="button"
                  >
                    {t('oauthClients.deleteClient', { name: displayName })}
                  </button>
                </div>
              </div>
            </article>
          );
        }}
        renderRow={(client) => {
          const displayName = displayNameForClient(client);
          const editable = client.managed_by === 'database';

          return (
            <tr>
              <td className="min-w-48">
                <div className="font-medium">{displayName}</div>
                <div className="break-all text-base-content/60 text-xs">
                  {client.id}
                </div>
              </td>
              <td className="font-mono text-xs">{client.client_id}</td>
              <td>
                <span
                  className={`badge ${client.enabled ? 'badge-success' : 'badge-ghost'}`}
                >
                  {client.enabled
                    ? t('oauthClients.enabled')
                    : t('oauthClients.disabled')}
                </span>
              </td>
              <td>
                <span className="badge badge-outline">
                  {client.managed_by === 'config'
                    ? t('oauthClients.readOnlyConfig')
                    : t('oauthClients.databaseManaged')}
                </span>
              </td>
              <td>
                {t('oauthClients.redirectUriCount', {
                  count: client.redirect_uris.length,
                })}
              </td>
              <td className="max-w-64 whitespace-normal">
                {client.grant_types.join(', ') || t('common.unknown')}
              </td>
              <td className="max-w-64 whitespace-normal font-mono text-xs">
                {client.scope}
              </td>
              <td className="whitespace-nowrap">
                {client.updated_at ?? t('common.unknown')}
              </td>
              <td>
                <div className="join join-vertical xl:join-horizontal">
                  <button
                    className="btn btn-outline join-item btn-xs"
                    disabled={!editable}
                    onClick={() => {
                      setModal({
                        mode: 'edit',
                        client,
                        form: formFromClient(client),
                      });
                    }}
                    title={
                      editable
                        ? t('oauthClients.editAction')
                        : t('oauthClients.readOnlyAction')
                    }
                    type="button"
                  >
                    {t('oauthClients.editClient', { name: displayName })}
                  </button>
                  <button
                    className="btn btn-error btn-outline join-item btn-xs"
                    disabled={!editable || deleteMutation.isPending}
                    onClick={() => {
                      setModal({ mode: 'delete', client });
                    }}
                    title={
                      editable
                        ? t('oauthClients.deleteAction')
                        : t('oauthClients.readOnlyAction')
                    }
                    type="button"
                  >
                    {t('oauthClients.deleteClient', { name: displayName })}
                  </button>
                </div>
              </td>
            </tr>
          );
        }}
        rows={clients}
      />

      <PaginationControls
        limit={pagination.limit}
        offset={pagination.offset}
        onOffsetChange={(offset) => {
          setParams({ ...params, offset });
        }}
        total={pagination.total}
      />

      {formModal && modalForm ? (
        <dialog
          aria-labelledby="oauth-client-dialog-title"
          className="modal modal-open"
          open={true}
        >
          <div className="modal-box max-w-3xl">
            <h2 className="font-bold text-lg" id="oauth-client-dialog-title">
              {formModal.mode === 'create'
                ? t('oauthClients.createTitle')
                : t('oauthClients.editTitle', {
                    name: displayNameForClient(formModal.client),
                  })}
            </h2>
            <form
              className="mt-6 grid gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const redirectUris = splitLines(formModal.form.redirectUris);
                const scope = splitWords(formModal.form.scope).join(' ');

                if (formModal.mode === 'create') {
                  createMutation.mutate({
                    client_id: formModal.form.clientId,
                    grant_types: ['authorization_code'],
                    id: formModal.form.clientId,
                    name: formModal.form.name,
                    redirect_uris: redirectUris,
                    response_types: ['code'],
                    scope,
                  });
                  return;
                }

                updateMutation.mutate({
                  enabled: formModal.form.enabled,
                  grant_types: formModal.client.grant_types,
                  id: formModal.client.id,
                  name: formModal.form.name,
                  redirect_uris: redirectUris,
                  response_types: formModal.client.response_types,
                  scope,
                });
              }}
            >
              <label className="form-control">
                <span className="label-text">{t('oauthClients.name')}</span>
                <input
                  aria-label={t('oauthClients.name')}
                  className="input input-bordered"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        name: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  value={modalForm.name}
                />
              </label>
              <label className="form-control">
                <span className="label-text">{t('oauthClients.clientId')}</span>
                <input
                  aria-label={t('oauthClients.clientId')}
                  className="input input-bordered font-mono text-xs"
                  disabled={formModal.mode === 'edit'}
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        clientId: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  value={modalForm.clientId}
                />
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text">
                  {t('oauthClients.redirectUris')}
                </span>
                <textarea
                  aria-label={t('oauthClients.redirectUris')}
                  className="textarea textarea-bordered min-h-24 font-mono text-xs"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        redirectUris: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  value={modalForm.redirectUris}
                />
              </label>
              <label className="form-control">
                <span className="label-text">{t('oauthClients.scope')}</span>
                <input
                  aria-label={t('oauthClients.scope')}
                  className="input input-bordered font-mono text-xs"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        scope: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  value={modalForm.scope}
                />
              </label>
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  aria-label={t('oauthClients.enabledToggle')}
                  checked={modalForm.enabled}
                  className="toggle toggle-primary"
                  disabled={formModal.mode === 'create'}
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        enabled: event.currentTarget.checked,
                      },
                    });
                  }}
                  type="checkbox"
                />
                <span className="label-text">{t('oauthClients.enabled')}</span>
              </label>
              <div className="modal-action md:col-span-2">
                <button
                  aria-label={t('oauthClients.closeDialog')}
                  className="btn btn-ghost"
                  onClick={() => {
                    setModal(null);
                  }}
                  type="button"
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  type="submit"
                >
                  {formModal.mode === 'create'
                    ? t('oauthClients.createClient')
                    : t('oauthClients.saveClient')}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      ) : null}

      {modal?.mode === 'delete' ? (
        <dialog
          aria-labelledby="oauth-client-delete-dialog-title"
          className="modal modal-open"
          open={true}
        >
          <div className="modal-box">
            <h2
              className="font-bold text-lg"
              id="oauth-client-delete-dialog-title"
            >
              {t('oauthClients.deleteTitle', {
                name: displayNameForClient(modal.client),
              })}
            </h2>
            <p className="py-4">
              {t('oauthClients.deleteDescription', {
                name: displayNameForClient(modal.client),
              })}
            </p>
            <div className="modal-action">
              <button
                aria-label={t('oauthClients.closeDialog')}
                className="btn btn-ghost"
                onClick={() => {
                  setModal(null);
                }}
                type="button"
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-error"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(modal.client.id);
                }}
                type="button"
              >
                {t('oauthClients.confirmDelete')}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
