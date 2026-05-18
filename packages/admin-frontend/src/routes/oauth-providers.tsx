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
  createOAuthProvider,
  deleteOAuthProvider,
  type OAuthProvider,
  type OAuthProviderCreateInput,
  updateOAuthProvider,
} from '#admin/libs/api.js';
import { oauthProvidersQueryOptions } from '#admin/queries/admin.js';
import { queryKeys } from '#admin/queries/keys.js';

type OAuthProviderFormState = {
  id: string;
  type: OAuthProvider['type'];
  issuer: string;
  displayName: string;
  iconUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  jwksUrl: string;
  emailUrl: string;
  responseMode: NonNullable<OAuthProvider['response_mode']>;
  emailConflictStrategy: OAuthProvider['email_conflict_strategy'];
  userinfoId: string;
  userinfoEmail: string;
  enabled: boolean;
};

type ModalState =
  | { mode: 'create'; form: OAuthProviderFormState }
  | { mode: 'edit'; provider: OAuthProvider; form: OAuthProviderFormState }
  | { mode: 'delete'; provider: OAuthProvider }
  | null;

const emptyProviderForm: OAuthProviderFormState = {
  id: '',
  type: 'generic_oauth',
  issuer: '',
  displayName: '',
  iconUrl: '',
  clientId: '',
  clientSecret: '',
  scopes: 'openid email profile',
  authorizationUrl: '',
  tokenUrl: '',
  userinfoUrl: '',
  jwksUrl: '',
  emailUrl: '',
  responseMode: 'query',
  emailConflictStrategy: 'auto_link',
  userinfoId: 'sub',
  userinfoEmail: 'email',
  enabled: true,
};

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function splitScopes(value: string): string[] {
  return value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseProviderType(value: string): OAuthProvider['type'] {
  if (value === 'github' || value === 'google' || value === 'apple') {
    return value;
  }

  return 'generic_oauth';
}

function parseResponseMode(
  value: string,
): NonNullable<OAuthProvider['response_mode']> {
  if (value === 'fragment' || value === 'form_post') {
    return value;
  }

  return 'query';
}

function parseConflictStrategy(
  value: string,
): OAuthProvider['email_conflict_strategy'] {
  if (value === 'require_link') {
    return value;
  }

  return 'auto_link';
}

function formFromProvider(provider: OAuthProvider): OAuthProviderFormState {
  return {
    id: provider.id,
    type: provider.type,
    issuer: provider.issuer ?? '',
    displayName: provider.display_name,
    iconUrl: provider.icon_url ?? '',
    clientId: provider.client_id,
    clientSecret: '',
    scopes: provider.scopes.join(' '),
    authorizationUrl: provider.authorization_url,
    tokenUrl: provider.token_url,
    userinfoUrl: provider.userinfo_url ?? '',
    jwksUrl: provider.jwks_url ?? '',
    emailUrl: provider.email_url ?? '',
    responseMode: provider.response_mode ?? 'query',
    emailConflictStrategy: provider.email_conflict_strategy,
    userinfoId: provider.userinfo_mapping.id,
    userinfoEmail: provider.userinfo_mapping.email,
    enabled: provider.enabled,
  };
}

function createPayloadFromForm(
  form: OAuthProviderFormState,
): OAuthProviderCreateInput {
  return {
    id: form.id,
    type: form.type,
    issuer: optionalText(form.issuer),
    display_name: form.displayName,
    icon_url: optionalText(form.iconUrl),
    client_id: form.clientId,
    client_secret: form.clientSecret,
    scopes: splitScopes(form.scopes),
    authorization_url: form.authorizationUrl,
    token_url: form.tokenUrl,
    userinfo_url: optionalText(form.userinfoUrl),
    jwks_url: optionalText(form.jwksUrl),
    email_url: optionalText(form.emailUrl),
    response_mode: form.responseMode,
    email_conflict_strategy: form.emailConflictStrategy,
    userinfo_mapping: {
      id: form.userinfoId,
      email: form.userinfoEmail,
    },
    enabled: form.enabled,
  };
}

export function OAuthProvidersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const search = useRouterState({ select: (state) => state.location.search });
  const [params, setParams] = useState(() => parseAdminListSearch(search));
  const [searchInput, setSearchInput] = useState(params.search);
  const { data: providersResponse } = useSuspenseQuery(
    oauthProvidersQueryOptions(params),
  );
  const [modal, setModal] = useState<ModalState>(null);
  const providers = providersResponse.items;
  const pagination = providersResponse.pagination;
  const invalidateProviders = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.oauthProviders(params),
    });
  };
  const createMutation = useMutation({
    mutationFn: createOAuthProvider,
    onSuccess: async () => {
      setModal(null);
      await invalidateProviders();
    },
  });
  const updateMutation = useMutation({
    mutationFn: updateOAuthProvider,
    onSuccess: async () => {
      setModal(null);
      await invalidateProviders();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteOAuthProvider,
    onSuccess: async () => {
      setModal(null);
      await invalidateProviders();
    },
  });
  const formModal = modal && modal.mode !== 'delete' ? modal : null;
  const modalForm = formModal?.form;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          subtitle={t('oauthProviders.subtitle')}
          title={t('oauthProviders.title')}
        />
        <button
          className="btn btn-primary"
          onClick={() => {
            setModal({ mode: 'create', form: emptyProviderForm });
          }}
          type="button"
        >
          {t('oauthProviders.addProvider')}
        </button>
      </div>

      <search>
        <form
          className="card flex flex-col gap-2 border border-base-300 bg-base-100 p-3 shadow-sm sm:flex-row sm:p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setParams({ ...params, offset: 0, search: searchInput.trim() });
          }}
        >
          <input
            aria-label={t('oauthProviders.search')}
            className="input input-bordered min-w-0 flex-1"
            onChange={(event) => {
              setSearchInput(event.currentTarget.value);
            }}
            placeholder={t('oauthProviders.searchPlaceholder')}
            type="search"
            value={searchInput}
          />
          <button
            aria-label={t('oauthProviders.search')}
            className="btn btn-outline"
            type="submit"
          >
            {t('common.search')}
          </button>
        </form>
      </search>

      <AdminTable
        ariaLabel={t('oauthProviders.tableLabel')}
        columns={[
          { key: 'provider', header: t('oauthProviders.provider') },
          { key: 'type', header: t('oauthProviders.type') },
          { key: 'status', header: t('oauthProviders.status') },
          { key: 'source', header: t('oauthProviders.source') },
          { key: 'secret', header: t('oauthProviders.secret') },
          { key: 'updated', header: t('oauthProviders.updated') },
          { key: 'actions', header: t('oauthProviders.actions') },
        ]}
        emptyMessage={t('oauthProviders.empty')}
        getRowKey={(provider) => provider.id}
        renderRow={(provider) => {
          const editable = provider.managed_by === 'database';
          return (
            <tr>
              <td className="min-w-56">
                <div className="font-medium">{provider.display_name}</div>
                <div className="break-all text-base-content/60 text-xs">
                  {provider.id}
                </div>
                <div className="break-all text-base-content/60 text-xs">
                  {provider.client_id}
                </div>
              </td>
              <td>{provider.type}</td>
              <td>
                <span
                  className={`badge ${provider.enabled ? 'badge-success' : 'badge-ghost'}`}
                >
                  {provider.enabled
                    ? t('oauthProviders.enabled')
                    : t('oauthProviders.disabled')}
                </span>
              </td>
              <td>
                <span className="badge badge-outline">
                  {provider.managed_by === 'config'
                    ? t('oauthProviders.readOnlyConfig')
                    : t('oauthProviders.databaseManaged')}
                </span>
              </td>
              <td>
                {provider.has_client_secret
                  ? t('oauthProviders.secretConfigured')
                  : t('oauthProviders.secretMissing')}
              </td>
              <td className="whitespace-nowrap">{provider.updated_at}</td>
              <td>
                <div className="join join-vertical xl:join-horizontal">
                  <button
                    className="btn btn-outline join-item btn-xs"
                    disabled={!editable}
                    onClick={() => {
                      setModal({
                        mode: 'edit',
                        provider,
                        form: formFromProvider(provider),
                      });
                    }}
                    type="button"
                  >
                    {t('oauthProviders.editProvider', {
                      name: provider.display_name,
                    })}
                  </button>
                  <button
                    className="btn btn-error btn-outline join-item btn-xs"
                    disabled={!editable || deleteMutation.isPending}
                    onClick={() => {
                      setModal({ mode: 'delete', provider });
                    }}
                    type="button"
                  >
                    {t('oauthProviders.deleteProvider', {
                      name: provider.display_name,
                    })}
                  </button>
                </div>
              </td>
            </tr>
          );
        }}
        rows={providers}
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
          aria-labelledby="oauth-provider-dialog-title"
          className="modal modal-open"
          open={true}
        >
          <div className="modal-box max-w-4xl">
            <h2 className="font-bold text-lg" id="oauth-provider-dialog-title">
              {formModal.mode === 'create'
                ? t('oauthProviders.createTitle')
                : t('oauthProviders.editTitle', {
                    name: formModal.provider.display_name,
                  })}
            </h2>
            <form
              className="mt-6 grid gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (formModal.mode === 'create') {
                  createMutation.mutate(createPayloadFromForm(formModal.form));
                  return;
                }

                const payload = createPayloadFromForm(formModal.form);
                updateMutation.mutate({
                  id: formModal.provider.id,
                  type: payload.type,
                  issuer: payload.issuer,
                  display_name: payload.display_name,
                  icon_url: payload.icon_url,
                  client_id: payload.client_id,
                  client_secret:
                    formModal.form.clientSecret.trim().length > 0
                      ? formModal.form.clientSecret
                      : undefined,
                  scopes: payload.scopes,
                  authorization_url: payload.authorization_url,
                  token_url: payload.token_url,
                  userinfo_url: payload.userinfo_url,
                  jwks_url: payload.jwks_url,
                  email_url: payload.email_url,
                  response_mode: payload.response_mode,
                  email_conflict_strategy: payload.email_conflict_strategy,
                  userinfo_mapping: payload.userinfo_mapping,
                  enabled: payload.enabled,
                });
              }}
            >
              <label className="form-control">
                <span className="label-text">{t('oauthProviders.id')}</span>
                <input
                  aria-label={t('oauthProviders.id')}
                  className="input input-bordered font-mono text-xs"
                  disabled={formModal.mode === 'edit'}
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        id: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  value={modalForm.id}
                />
              </label>
              <label className="form-control">
                <span className="label-text">
                  {t('oauthProviders.displayName')}
                </span>
                <input
                  aria-label={t('oauthProviders.displayName')}
                  className="input input-bordered"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        displayName: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  value={modalForm.displayName}
                />
              </label>
              <label className="form-control">
                <span className="label-text">{t('oauthProviders.type')}</span>
                <select
                  aria-label={t('oauthProviders.type')}
                  className="select select-bordered"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        type: parseProviderType(event.currentTarget.value),
                      },
                    });
                  }}
                  value={modalForm.type}
                >
                  <option value="generic_oauth">generic_oauth</option>
                  <option value="github">github</option>
                  <option value="google">google</option>
                  <option value="apple">apple</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text">
                  {t('oauthProviders.clientId')}
                </span>
                <input
                  aria-label={t('oauthProviders.clientId')}
                  className="input input-bordered font-mono text-xs"
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
              <label className="form-control">
                <span className="label-text">
                  {t('oauthProviders.clientSecret')}
                </span>
                <input
                  aria-label={t('oauthProviders.clientSecret')}
                  autoComplete="new-password"
                  className="input input-bordered font-mono text-xs"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        clientSecret: event.currentTarget.value,
                      },
                    });
                  }}
                  required={formModal.mode === 'create'}
                  type="password"
                  value={modalForm.clientSecret}
                />
              </label>
              <label className="form-control">
                <span className="label-text">{t('oauthProviders.scopes')}</span>
                <input
                  aria-label={t('oauthProviders.scopes')}
                  className="input input-bordered font-mono text-xs"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        scopes: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  value={modalForm.scopes}
                />
              </label>
              <label className="form-control">
                <span className="label-text">
                  {t('oauthProviders.authorizationUrl')}
                </span>
                <input
                  aria-label={t('oauthProviders.authorizationUrl')}
                  className="input input-bordered font-mono text-xs"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        authorizationUrl: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  type="url"
                  value={modalForm.authorizationUrl}
                />
              </label>
              <label className="form-control">
                <span className="label-text">
                  {t('oauthProviders.tokenUrl')}
                </span>
                <input
                  aria-label={t('oauthProviders.tokenUrl')}
                  className="input input-bordered font-mono text-xs"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        tokenUrl: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  type="url"
                  value={modalForm.tokenUrl}
                />
              </label>
              <label className="form-control">
                <span className="label-text">
                  {t('oauthProviders.userinfoUrl')}
                </span>
                <input
                  aria-label={t('oauthProviders.userinfoUrl')}
                  className="input input-bordered font-mono text-xs"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        userinfoUrl: event.currentTarget.value,
                      },
                    });
                  }}
                  type="url"
                  value={modalForm.userinfoUrl}
                />
              </label>
              <label className="form-control">
                <span className="label-text">{t('oauthProviders.issuer')}</span>
                <input
                  aria-label={t('oauthProviders.issuer')}
                  className="input input-bordered font-mono text-xs"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        issuer: event.currentTarget.value,
                      },
                    });
                  }}
                  type="url"
                  value={modalForm.issuer}
                />
              </label>
              <label className="form-control">
                <span className="label-text">
                  {t('oauthProviders.responseMode')}
                </span>
                <select
                  aria-label={t('oauthProviders.responseMode')}
                  className="select select-bordered"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        responseMode: parseResponseMode(
                          event.currentTarget.value,
                        ),
                      },
                    });
                  }}
                  value={modalForm.responseMode}
                >
                  <option value="query">query</option>
                  <option value="fragment">fragment</option>
                  <option value="form_post">form_post</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text">
                  {t('oauthProviders.emailConflictStrategy')}
                </span>
                <select
                  aria-label={t('oauthProviders.emailConflictStrategy')}
                  className="select select-bordered"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        emailConflictStrategy: parseConflictStrategy(
                          event.currentTarget.value,
                        ),
                      },
                    });
                  }}
                  value={modalForm.emailConflictStrategy}
                >
                  <option value="auto_link">auto_link</option>
                  <option value="require_link">require_link</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text">
                  {t('oauthProviders.userinfoId')}
                </span>
                <input
                  aria-label={t('oauthProviders.userinfoId')}
                  className="input input-bordered font-mono text-xs"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        userinfoId: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  value={modalForm.userinfoId}
                />
              </label>
              <label className="form-control">
                <span className="label-text">
                  {t('oauthProviders.userinfoEmail')}
                </span>
                <input
                  aria-label={t('oauthProviders.userinfoEmail')}
                  className="input input-bordered font-mono text-xs"
                  onChange={(event) => {
                    setModal({
                      ...formModal,
                      form: {
                        ...formModal.form,
                        userinfoEmail: event.currentTarget.value,
                      },
                    });
                  }}
                  required={true}
                  value={modalForm.userinfoEmail}
                />
              </label>
              <label className="label cursor-pointer justify-start gap-3 md:col-span-2">
                <input
                  aria-label={t('oauthProviders.enabledToggle')}
                  checked={modalForm.enabled}
                  className="toggle toggle-primary"
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
                <span className="label-text">
                  {t('oauthProviders.enabled')}
                </span>
              </label>
              <div className="modal-action md:col-span-2">
                <button
                  aria-label={t('oauthProviders.closeDialog')}
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
                    ? t('oauthProviders.createProvider')
                    : t('oauthProviders.saveProvider')}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      ) : null}

      {modal?.mode === 'delete' ? (
        <dialog
          aria-labelledby="oauth-provider-delete-dialog-title"
          className="modal modal-open"
          open={true}
        >
          <div className="modal-box">
            <h2
              className="font-bold text-lg"
              id="oauth-provider-delete-dialog-title"
            >
              {t('oauthProviders.deleteTitle', {
                name: modal.provider.display_name,
              })}
            </h2>
            <p className="py-4">
              {t('oauthProviders.deleteDescription', {
                name: modal.provider.display_name,
              })}
            </p>
            <div className="modal-action">
              <button
                aria-label={t('oauthProviders.closeDialog')}
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
                  deleteMutation.mutate(modal.provider.id);
                }}
                type="button"
              >
                {t('oauthProviders.confirmDelete')}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
