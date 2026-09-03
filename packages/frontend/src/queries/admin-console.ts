import { queryOptions } from '@tanstack/react-query';
import { type ApiClient, client, jsonOk } from '#frontend/libs/api.ts';

export type AdminListQuery = {
  query?: string;
  page?: number;
  pageSize?: number;
  managedBy?: 'database' | 'config';
  direction?: 'asc' | 'desc';
};

export type AdminClientsQuery = AdminListQuery & {
  lifecycleStatus?: 'active' | 'inactive' | 'deleted';
  type?: 'public' | 'confidential';
};

export type AdminTermsQuery = AdminListQuery & {
  required?: boolean;
  consentMode?: 'explicit' | 'implicit';
  archived?: boolean;
};

function commonQuery(query: AdminListQuery) {
  return {
    query: query.query,
    page: String(query.page ?? 1),
    page_size: String(query.pageSize ?? 20),
    managed_by: query.managedBy,
    direction: query.direction ?? 'asc',
  };
}

async function fetchOverview(apiClient: ApiClient) {
  return jsonOk(await apiClient.api.admin.overview.$get());
}

async function fetchSystem(apiClient: ApiClient) {
  return jsonOk(await apiClient.api.admin.system.$get());
}

async function fetchClients(apiClient: ApiClient, query: AdminClientsQuery) {
  return jsonOk(
    await apiClient.api.admin.clients.$get({
      query: {
        ...commonQuery(query),
        lifecycle_status: query.lifecycleStatus,
        type: query.type,
      },
    }),
  );
}

async function fetchTerms(apiClient: ApiClient, query: AdminTermsQuery) {
  return jsonOk(
    await apiClient.api.admin.terms.$get({
      query: {
        ...commonQuery(query),
        required:
          query.required === undefined ? undefined : String(query.required),
        consent_mode: query.consentMode,
        archived:
          query.archived === undefined ? undefined : String(query.archived),
      },
    }),
  );
}

export const createAdminOverviewQueryOptions = (apiClient: ApiClient) =>
  queryOptions({
    queryKey: ['admin', 'overview'],
    queryFn: () => fetchOverview(apiClient),
  });

export const adminOverviewQueryOptions =
  createAdminOverviewQueryOptions(client);

export const createAdminSystemQueryOptions = (apiClient: ApiClient) =>
  queryOptions({
    queryKey: ['admin', 'system'],
    queryFn: () => fetchSystem(apiClient),
  });

export const adminSystemQueryOptions = createAdminSystemQueryOptions(client);

export const createAdminClientsQueryOptions = (
  apiClient: ApiClient,
  query: AdminClientsQuery = {},
) =>
  queryOptions({
    queryKey: ['admin', 'clients', query],
    queryFn: () => fetchClients(apiClient, query),
  });

export const adminClientsQueryOptions = (query: AdminClientsQuery = {}) =>
  createAdminClientsQueryOptions(client, query);

export const createAdminTermsQueryOptions = (
  apiClient: ApiClient,
  query: AdminTermsQuery = {},
) =>
  queryOptions({
    queryKey: ['admin', 'terms', query],
    queryFn: () => fetchTerms(apiClient, query),
  });

export const adminTermsQueryOptions = (query: AdminTermsQuery = {}) =>
  createAdminTermsQueryOptions(client, query);

export async function searchAdmin(query: string) {
  return jsonOk(await client.api.admin.search.$get({ query: { q: query } }));
}

export type AdminClientInput = {
  client_id: string;
  name: string;
  type: 'public' | 'confidential';
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  web_origins: string[];
  grant_types: string[];
  response_types: string[];
  scopes: string[];
  skip_consent: boolean;
};

export async function createAdminClient(input: AdminClientInput) {
  return jsonOk(await client.api.admin.clients.$post({ json: input }));
}

export async function updateAdminClient(
  id: string,
  input: Omit<AdminClientInput, 'client_id' | 'type'>,
) {
  return jsonOk(
    await client.api.admin.clients[':id'].$patch({
      param: { id },
      json: input,
    }),
  );
}

export async function rotateAdminClientSecret(id: string) {
  return jsonOk(
    await client.api.admin.clients[':id']['rotate-secret'].$post({
      param: { id },
    }),
  );
}

export async function deleteAdminClient(id: string) {
  return jsonOk(
    await client.api.admin.clients[':id'].$delete({ param: { id } }),
  );
}

export async function restoreAdminClient(id: string) {
  return jsonOk(
    await client.api.admin.clients[':id'].restore.$post({ param: { id } }),
  );
}

export type AdminTermInput = {
  id: string;
  required: boolean;
  consent_mode: 'explicit' | 'implicit';
  version: string;
  contents: Array<{
    lang: 'ko' | 'en' | 'ja';
    title: string;
    type: 'link' | 'text';
    content: string;
  }>;
};

export async function createAdminTerm(input: AdminTermInput) {
  return jsonOk(await client.api.admin.terms.$post({ json: input }));
}

export async function updateAdminTerm(
  id: string,
  input: Omit<AdminTermInput, 'id'>,
) {
  return jsonOk(
    await client.api.admin.terms[':id'].$patch({ param: { id }, json: input }),
  );
}

export type BulkTarget<TFilter> =
  | { kind: 'ids'; ids: string[] }
  | { kind: 'filter'; filter: TFilter };

export async function bulkSetAdminClientsActive(input: {
  target: BulkTarget<{
    query?: string | undefined;
    managed_by?: 'database' | 'config' | undefined;
    enabled?: boolean | undefined;
  }>;
  active: boolean;
}) {
  return jsonOk(
    await client.api.admin.clients['bulk-status'].$post({ json: input }),
  );
}

export type AdminClientBulkTarget = BulkTarget<{
  query?: string | undefined;
  managed_by?: 'database' | 'config' | undefined;
  enabled?: boolean | undefined;
}>;

export async function bulkSetAdminTermsActive(input: {
  target: BulkTarget<{
    query?: string | undefined;
    managed_by?: 'database' | 'config' | undefined;
    archived?: boolean | undefined;
  }>;
  active: boolean;
}) {
  return jsonOk(
    await client.api.admin.terms['bulk-status'].$post({ json: input }),
  );
}

export type AdminTermBulkTarget = BulkTarget<{
  query?: string | undefined;
  managed_by?: 'database' | 'config' | undefined;
  archived?: boolean | undefined;
}>;

export type AdminClient = Awaited<
  ReturnType<typeof fetchClients>
>['clients'][number];
export type AdminTerm = Awaited<ReturnType<typeof fetchTerms>>['terms'][number];
