import { z } from 'zod';
import i18n from '#admin/i18n/index.js';
import { AdminApiError } from './error.js';

const AdminUserSchema = z.object({
  sub: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
  role: z.enum(['user', 'admin']),
  managed_by: z.enum(['database', 'config']),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const AdminSessionSchema = z.object({
  is_admin: z.literal(true),
  user: AdminUserSchema,
});

const PaginationSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

function paginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: PaginationSchema,
  });
}

const OAuthClientSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  name: z.string(),
  redirect_uris: z.array(z.string()).default([]),
  response_types: z.array(z.string()).default([]),
  grant_types: z.array(z.string()).default([]),
  scope: z.string().default(''),
  enabled: z.boolean().default(true),
  managed_by: z.enum(['database', 'config']).default('database'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  logo_uri: z.string().nullable().optional(),
});

const OAuthProviderSchema = z.object({
  id: z.string(),
  type: z.enum(['github', 'google', 'apple', 'generic_oauth']),
  issuer: z.string().nullable(),
  display_name: z.string(),
  icon_url: z.string().nullable(),
  client_id: z.string(),
  has_client_secret: z.boolean(),
  scopes: z.array(z.string()),
  authorization_url: z.string(),
  token_url: z.string(),
  userinfo_url: z.string().nullable(),
  jwks_url: z.string().nullable(),
  email_url: z.string().nullable(),
  response_mode: z.enum(['query', 'fragment', 'form_post']).nullable(),
  email_conflict_strategy: z.enum(['auto_link', 'require_link']),
  userinfo_mapping: z.object({
    id: z.string(),
    email: z.string(),
    email_verified: z.string().optional(),
    name: z.string().optional(),
    picture: z.string().optional(),
  }),
  enabled: z.boolean(),
  managed_by: z.enum(['database', 'config']),
  created_at: z.string(),
  updated_at: z.string(),
});

const AdminUsersResponseSchema = paginatedResponseSchema(AdminUserSchema);
const OAuthClientsResponseSchema = paginatedResponseSchema(OAuthClientSchema);
const OAuthProvidersResponseSchema =
  paginatedResponseSchema(OAuthProviderSchema);

export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminSession = z.infer<typeof AdminSessionSchema>;
export type OAuthClient = z.infer<typeof OAuthClientSchema>;
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;
export type AdminPaginationParams = {
  limit?: number;
  offset?: number;
  search?: string;
};
export type PaginatedResponse<T> = {
  items: T[];
  pagination: z.infer<typeof PaginationSchema>;
};

function withPaginationParams(
  path: string,
  params: AdminPaginationParams = {},
): string {
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined) {
    searchParams.set('limit', params.limit.toString());
  }

  if (params.offset !== undefined) {
    searchParams.set('offset', params.offset.toString());
  }

  const search = params.search?.trim();
  if (search) {
    searchParams.set('search', search);
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

async function fetchJson(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Accept-Language', i18n.language || 'en');

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    throw await AdminApiError.fromResponse(response);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getAdminSession(): Promise<AdminSession> {
  return AdminSessionSchema.parse(await fetchJson('/admin/api/session'));
}

export async function listAdminUsers(
  params: AdminPaginationParams = {},
): Promise<PaginatedResponse<AdminUser>> {
  const response = AdminUsersResponseSchema.parse(
    await fetchJson(withPaginationParams('/admin/api/users', params)),
  );
  return response;
}

type AdminUserUpdateInput = {
  sub: string;
  role?: AdminUser['role'];
  email_verified?: boolean;
};

export async function updateAdminUser(
  params: AdminUserUpdateInput,
): Promise<AdminUser> {
  const response = z.object({ user: AdminUserSchema }).parse(
    await fetchJson(`/admin/api/users/${encodeURIComponent(params.sub)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_verified: params.email_verified,
        role: params.role,
      }),
    }),
  );
  return response.user;
}

export async function updateAdminUserRole(params: {
  sub: string;
  role: AdminUser['role'];
}): Promise<AdminUser> {
  return updateAdminUser(params);
}

export async function updateAdminUserEmailVerification(params: {
  sub: string;
  email_verified: boolean;
}): Promise<AdminUser> {
  return updateAdminUser(params);
}

export async function listOAuthClients(
  params: AdminPaginationParams = {},
): Promise<PaginatedResponse<OAuthClient>> {
  const response = OAuthClientsResponseSchema.parse(
    await fetchJson(withPaginationParams('/admin/api/oauth-clients', params)),
  );
  return response;
}

export async function listOAuthProviders(
  params: AdminPaginationParams = {},
): Promise<PaginatedResponse<OAuthProvider>> {
  const response = OAuthProvidersResponseSchema.parse(
    await fetchJson(withPaginationParams('/admin/api/oauth-providers', params)),
  );
  return response;
}

const OAuthClientMutationResponseSchema = z.object({
  oauth_client: OAuthClientSchema,
});

export type OAuthClientCreateInput = {
  id: string;
  client_id: string;
  name: string;
  redirect_uris: string[];
  response_types: string[];
  grant_types: string[];
  scope: string;
};

export type OAuthClientUpdateInput = {
  id: string;
  name: string;
  redirect_uris: string[];
  response_types: string[];
  grant_types: string[];
  scope: string;
  enabled: boolean;
};

export async function createOAuthClient(
  input: OAuthClientCreateInput,
): Promise<OAuthClient> {
  const response = OAuthClientMutationResponseSchema.parse(
    await fetchJson('/admin/api/oauth-clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
  );
  return response.oauth_client;
}

export async function updateOAuthClient(
  input: OAuthClientUpdateInput,
): Promise<OAuthClient> {
  const response = OAuthClientMutationResponseSchema.parse(
    await fetchJson(
      `/admin/api/oauth-clients/${encodeURIComponent(input.id)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: input.enabled,
          grant_types: input.grant_types,
          name: input.name,
          redirect_uris: input.redirect_uris,
          response_types: input.response_types,
          scope: input.scope,
        }),
      },
    ),
  );
  return response.oauth_client;
}

export async function deleteOAuthClient(id: string): Promise<void> {
  await fetchJson(`/admin/api/oauth-clients/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

const OAuthProviderMutationResponseSchema = z.object({
  oauth_provider: OAuthProviderSchema,
});

export type OAuthProviderCreateInput = {
  id: string;
  type: OAuthProvider['type'];
  issuer: string | null;
  display_name: string;
  icon_url: string | null;
  client_id: string;
  client_secret: string;
  scopes: string[];
  authorization_url: string;
  token_url: string;
  userinfo_url: string | null;
  jwks_url: string | null;
  email_url: string | null;
  response_mode: OAuthProvider['response_mode'];
  email_conflict_strategy: OAuthProvider['email_conflict_strategy'];
  userinfo_mapping: OAuthProvider['userinfo_mapping'];
  enabled: boolean;
};

export type OAuthProviderUpdateInput = {
  id: string;
  type?: OAuthProvider['type'];
  issuer?: string | null;
  display_name?: string;
  icon_url?: string | null;
  client_id?: string;
  client_secret?: string;
  scopes?: string[];
  authorization_url?: string;
  token_url?: string;
  userinfo_url?: string | null;
  jwks_url?: string | null;
  email_url?: string | null;
  response_mode?: OAuthProvider['response_mode'];
  email_conflict_strategy?: OAuthProvider['email_conflict_strategy'];
  userinfo_mapping?: OAuthProvider['userinfo_mapping'];
  enabled?: boolean;
};

export async function createOAuthProvider(
  input: OAuthProviderCreateInput,
): Promise<OAuthProvider> {
  const response = OAuthProviderMutationResponseSchema.parse(
    await fetchJson('/admin/api/oauth-providers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
  );
  return response.oauth_provider;
}

export async function updateOAuthProvider(
  input: OAuthProviderUpdateInput,
): Promise<OAuthProvider> {
  const { id, ...body } = input;
  const response = OAuthProviderMutationResponseSchema.parse(
    await fetchJson(`/admin/api/oauth-providers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  return response.oauth_provider;
}

export async function deleteOAuthProvider(id: string): Promise<void> {
  await fetchJson(`/admin/api/oauth-providers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
