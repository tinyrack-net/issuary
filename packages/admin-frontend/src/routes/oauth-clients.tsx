import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '#admin/components/page-header.js';
import {
  createOAuthClient,
  deleteOAuthClient,
  type OAuthClient,
  updateOAuthClient,
} from '#admin/libs/api.js';
import { oauthClientsQueryOptions } from '#admin/queries/admin.js';
import { queryKeys } from '#admin/queries/keys.js';

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function splitWords(value: string): string[] {
  return value
    .split(' ')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function OAuthClientCard({ client }: { client: OAuthClient }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(client.name);
  const [redirectUris, setRedirectUris] = useState(
    client.redirect_uris.join('\n'),
  );
  const [scope, setScope] = useState(client.scope);
  const [enabled, setEnabled] = useState(client.enabled);
  const displayName = client.name || client.client_id;
  const editable = client.managed_by === 'database';
  const invalidateClients = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.oauthClients() });
  };
  const updateMutation = useMutation({
    mutationFn: updateOAuthClient,
    onSuccess: invalidateClients,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteOAuthClient,
    onSuccess: invalidateClients,
  });

  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div>
          <h2 className="card-title">{displayName}</h2>
          <p className="text-base-content/70 text-sm">
            {t('oauthClients.clientId')}: {client.client_id}
          </p>
        </div>
        <label className="form-control">
          <span className="label-text">
            {t('oauthClients.nameFor', { name: displayName })}
          </span>
          <input
            aria-label={t('oauthClients.nameFor', { name: displayName })}
            className="input input-bordered"
            disabled={!editable}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
            value={name}
          />
        </label>
        <label className="form-control">
          <span className="label-text">
            {t('oauthClients.redirectUrisFor', { name: displayName })}
          </span>
          <textarea
            aria-label={t('oauthClients.redirectUrisFor', {
              name: displayName,
            })}
            className="textarea textarea-bordered min-h-24 font-mono text-xs"
            disabled={!editable}
            onChange={(event) => {
              setRedirectUris(event.currentTarget.value);
            }}
            value={redirectUris}
          />
        </label>
        <label className="form-control">
          <span className="label-text">{t('oauthClients.scope')}</span>
          <input
            className="input input-bordered font-mono text-xs"
            disabled={!editable}
            onChange={(event) => {
              setScope(event.currentTarget.value);
            }}
            value={scope}
          />
        </label>
        <label className="label cursor-pointer justify-start gap-3">
          <input
            checked={enabled}
            className="toggle toggle-primary"
            disabled={!editable}
            onChange={(event) => {
              setEnabled(event.currentTarget.checked);
            }}
            type="checkbox"
          />
          <span className="label-text">{t('oauthClients.enabled')}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary btn-sm"
            disabled={!editable || updateMutation.isPending}
            onClick={() => {
              updateMutation.mutate({
                enabled,
                grant_types: client.grant_types,
                id: client.id,
                name,
                redirect_uris: splitLines(redirectUris),
                response_types: client.response_types,
                scope,
              });
            }}
            type="button"
          >
            {t('oauthClients.saveClient', { name: displayName })}
          </button>
          <button
            className="btn btn-error btn-outline btn-sm"
            disabled={!editable || deleteMutation.isPending}
            onClick={() => {
              deleteMutation.mutate(client.id);
            }}
            type="button"
          >
            {t('oauthClients.deleteClient', { name: displayName })}
          </button>
        </div>
      </div>
    </article>
  );
}

export function OAuthClientsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: clients } = useSuspenseQuery(oauthClientsQueryOptions);
  const [newName, setNewName] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newRedirectUris, setNewRedirectUris] = useState('');
  const [newScope, setNewScope] = useState('openid profile');
  const createMutation = useMutation({
    mutationFn: createOAuthClient,
    onSuccess: async () => {
      setNewName('');
      setNewClientId('');
      setNewRedirectUris('');
      setNewScope('openid profile');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.oauthClients(),
      });
    },
  });

  return (
    <section className="space-y-6">
      <PageHeader
        subtitle={t('oauthClients.subtitle')}
        title={t('oauthClients.title')}
      />
      <form
        className="card border border-base-300 bg-base-100 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate({
            client_id: newClientId,
            grant_types: ['authorization_code'],
            id: newClientId,
            name: newName,
            redirect_uris: splitLines(newRedirectUris),
            response_types: ['code'],
            scope: splitWords(newScope).join(' '),
          });
        }}
      >
        <div className="card-body gap-4">
          <h2 className="card-title">{t('oauthClients.createTitle')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text">{t('oauthClients.name')}</span>
              <input
                aria-label={t('oauthClients.name')}
                className="input input-bordered"
                onChange={(event) => {
                  setNewName(event.currentTarget.value);
                }}
                required={true}
                value={newName}
              />
            </label>
            <label className="form-control">
              <span className="label-text">{t('oauthClients.clientId')}</span>
              <input
                aria-label={t('oauthClients.clientId')}
                className="input input-bordered font-mono text-xs"
                onChange={(event) => {
                  setNewClientId(event.currentTarget.value);
                }}
                required={true}
                value={newClientId}
              />
            </label>
          </div>
          <label className="form-control">
            <span className="label-text">{t('oauthClients.redirectUris')}</span>
            <textarea
              aria-label={t('oauthClients.redirectUris')}
              className="textarea textarea-bordered min-h-24 font-mono text-xs"
              onChange={(event) => {
                setNewRedirectUris(event.currentTarget.value);
              }}
              required={true}
              value={newRedirectUris}
            />
          </label>
          <label className="form-control">
            <span className="label-text">{t('oauthClients.scope')}</span>
            <input
              aria-label={t('oauthClients.scope')}
              className="input input-bordered font-mono text-xs"
              onChange={(event) => {
                setNewScope(event.currentTarget.value);
              }}
              required={true}
              value={newScope}
            />
          </label>
          <div>
            <button
              className="btn btn-primary"
              disabled={createMutation.isPending}
              type="submit"
            >
              {t('oauthClients.createClient')}
            </button>
          </div>
        </div>
      </form>
      {clients.length === 0 ? (
        <div className="alert">{t('oauthClients.empty')}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {clients.map((client) => (
            <OAuthClientCard client={client} key={client.id} />
          ))}
        </div>
      )}
    </section>
  );
}
