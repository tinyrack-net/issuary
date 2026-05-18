import { z } from 'zod';
import i18n from '#admin/i18n/index.js';
import { AdminApiError } from './error.js';

const AdminUserSchema = z.object({
  sub: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
  role: z.enum(['user', 'admin']),
  managed_by: z.enum(['database', 'config']),
});

const AdminSessionSchema = z.object({
  is_admin: z.literal(true),
  user: AdminUserSchema,
});

const AdminUsersResponseSchema = z.object({
  users: z.array(AdminUserSchema),
});

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
  logo_uri: z.string().nullable().optional(),
});

const OAuthClientsResponseSchema = z.object({
  oauth_clients: z.array(OAuthClientSchema),
});

const AuditEventSchema = z.object({
  id: z.string(),
  actor_sub: z.string(),
  action: z.string(),
  target_type: z.string(),
  target_id: z.string(),
  metadata: z.unknown(),
  ip: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string(),
});

const AuditEventsResponseSchema = z.object({
  audit_events: z.array(AuditEventSchema),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminSession = z.infer<typeof AdminSessionSchema>;
export type OAuthClient = z.infer<typeof OAuthClientSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;

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

export async function listAdminUsers(): Promise<AdminUser[]> {
  const response = AdminUsersResponseSchema.parse(
    await fetchJson('/admin/api/users'),
  );
  return response.users;
}

export async function updateAdminUserRole(params: {
  sub: string;
  role: AdminUser['role'];
}): Promise<AdminUser> {
  const response = z.object({ user: AdminUserSchema }).parse(
    await fetchJson(`/admin/api/users/${encodeURIComponent(params.sub)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: params.role }),
    }),
  );
  return response.user;
}

export async function listOAuthClients(): Promise<OAuthClient[]> {
  const response = OAuthClientsResponseSchema.parse(
    await fetchJson('/admin/api/oauth-clients'),
  );
  return response.oauth_clients;
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

export async function listAuditEvents(): Promise<AuditEvent[]> {
  const response = AuditEventsResponseSchema.parse(
    await fetchJson('/admin/api/audit-events'),
  );
  return response.audit_events;
}
