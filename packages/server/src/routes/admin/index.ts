import { Hono } from 'hono';
import { validator } from 'hono-openapi';
import { z } from 'zod';
import type { IAdminAuditEventEntity } from '../../entities/admin-audit-event.entity.ts';
import type { IOAuthClientEntity } from '../../entities/oauth-client.entity.ts';
import type { UserEntity } from '../../entities/user.entity.ts';
import type { AppEnv } from '../../lib/app-env.ts';
import { isSecureRedirectUri } from '../../lib/config/url-policy.ts';
import { verifyAdmin } from '../../middleware/admin-auth.ts';
import { e } from '../../schemas/error.ts';
import type { ServiceContainer } from '../../services/container.ts';

const UserParamsSchema = z.object({
  sub: z.string().min(1),
});

const OAuthClientParamsSchema = z.object({
  id: z.string().min(1),
});

const AuditEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const RedirectUriSchema = z.string().refine(isSecureRedirectUri, {
  message:
    'Redirect URI must use HTTPS or local HTTP and must not contain fragments or wildcards.',
});

const OAuthClientBaseSchema = z.object({
  name: z.string().min(1).max(255),
  redirect_uris: z.array(RedirectUriSchema).min(1),
  response_types: z.array(z.string().min(1)).min(1),
  grant_types: z.array(z.string().min(1)).min(1),
  scope: z.string().min(1),
  enabled: z.boolean().optional(),
  logo_uri: z.string().url().nullable().optional(),
});

const CreateOAuthClientSchema = OAuthClientBaseSchema.extend({
  id: z.string().min(1).max(255),
  client_id: z.string().min(1).max(255),
  client_secret: z.string().min(1).optional(),
}).strict();

const UpdateOAuthClientSchema = OAuthClientBaseSchema.partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

const UpdateUserSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    email_verified: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.role !== undefined || value.email_verified !== undefined,
    {
      message: 'At least one field is required.',
    },
  );

type SerializedAdminUser = {
  sub: string;
  email: string;
  email_verified: boolean;
  role: 'user' | 'admin';
  managed_by: 'database' | 'config';
  created_at: string;
  updated_at: string;
};

type SerializedOAuthClient = {
  id: string;
  client_id: string;
  name: string;
  redirect_uris: string[];
  response_types: string[];
  grant_types: string[];
  scope: string;
  enabled: boolean;
  managed_by: 'database' | 'config';
  logo_uri: string | null;
  created_at: string;
  updated_at: string;
};

type SerializedAdminAuditEvent = {
  id: string;
  actor_sub: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: unknown;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

function serializeAdminUser(user: UserEntity): SerializedAdminUser {
  return {
    sub: user.sub,
    email: user.email,
    email_verified: user.email_verified,
    role: user.role,
    managed_by: user.managed_by,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
  };
}

function serializeOAuthClient(
  client: IOAuthClientEntity,
): SerializedOAuthClient {
  return {
    id: client.id,
    client_id: client.clientId,
    name: client.name,
    redirect_uris: client.redirectUris,
    response_types: client.responseTypes,
    grant_types: client.grantTypes,
    scope: client.scopes.join(' '),
    enabled: client.enabled,
    managed_by: client.managed_by,
    logo_uri: client.logoUri ?? null,
    created_at: client.created_at.toISOString(),
    updated_at: client.updated_at.toISOString(),
  };
}

function parseAdminAuditMetadata(metadataJson: string) {
  try {
    return JSON.parse(metadataJson);
  } catch {
    return null;
  }
}

function serializeAdminAuditEvent(
  event: IAdminAuditEventEntity,
): SerializedAdminAuditEvent {
  return {
    id: event.id,
    actor_sub: event.actorSub,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId,
    metadata: parseAdminAuditMetadata(event.metadataJson),
    ip: event.ip ?? null,
    user_agent: event.userAgent ?? null,
    created_at: event.created_at.toISOString(),
  };
}

async function findActiveUserOrFail(services: ServiceContainer, sub: string) {
  return services.mikro.user.findOneOrFail(
    { sub, deleted_at: null },
    { failHandler: () => new e.UserNotFound.Error() },
  );
}

async function countActiveAdmins(services: ServiceContainer) {
  return services.mikro.user.count({
    role: 'admin',
    deleted_at: null,
  });
}

async function findOAuthClientOrFail(services: ServiceContainer, id: string) {
  return services.mikro.oauthClient.findOneOrFail(
    { id },
    { failHandler: () => new e.OAuthClientNotFound.Error() },
  );
}

export const adminApiRoutes = new Hono<AppEnv>()
  .get('/session', verifyAdmin(), async (c) => {
    const { user } = c.var.verifiedAdmin;

    return c.json(
      {
        is_admin: true,
        user: {
          sub: user.sub,
          email: user.email,
          email_verified: user.email_verified,
          role: user.role,
          managed_by: user.managed_by,
        },
      },
      200,
    );
  })
  .get('/users', verifyAdmin(), async (c) => {
    const users = await c.var.services.mikro.user.find(
      { deleted_at: null },
      { orderBy: { created_at: 'ASC' } },
    );

    return c.json({ users: users.map(serializeAdminUser) }, 200);
  })
  .get(
    '/users/:sub',
    validator('param', UserParamsSchema),
    verifyAdmin(),
    async (c) => {
      const params = c.req.valid('param');
      const user = await findActiveUserOrFail(c.var.services, params.sub);

      return c.json({ user: serializeAdminUser(user) }, 200);
    },
  )
  .patch(
    '/users/:sub',
    validator('param', UserParamsSchema),
    validator('json', UpdateUserSchema),
    verifyAdmin(),
    async (c) => {
      const params = c.req.valid('param');
      const body = c.req.valid('json');
      const { user: actor } = c.var.verifiedAdmin;
      const user = await findActiveUserOrFail(c.var.services, params.sub);
      const removesAdminRole = user.role === 'admin' && body.role === 'user';

      if (removesAdminRole && (await countActiveAdmins(c.var.services)) <= 1) {
        throw new e.LastAdminRequired.Error();
      }

      if (removesAdminRole && user.sub === actor.sub) {
        throw new e.SelfDemotionNotAllowed.Error();
      }

      if (user.managed_by === 'config') {
        throw new e.UserNotEditable.Error();
      }

      const before = serializeAdminUser(user);

      if (body.role !== undefined) {
        user.role = body.role;
      }
      if (body.email_verified !== undefined) {
        user.email_verified = body.email_verified;
      }

      await c.var.services.mikro.em.flush();
      await c.var.services.adminAuditService.record({
        actorSub: actor.sub,
        action: 'admin.user.update',
        targetType: 'user',
        targetId: user.sub,
        metadata: {
          before,
          after: serializeAdminUser(user),
        },
        ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
      });

      return c.json({ user: serializeAdminUser(user) }, 200);
    },
  )
  .delete(
    '/users/:sub',
    validator('param', UserParamsSchema),
    verifyAdmin(),
    async (c) => {
      const params = c.req.valid('param');
      const user = await findActiveUserOrFail(c.var.services, params.sub);

      if (
        user.role === 'admin' &&
        (await countActiveAdmins(c.var.services)) <= 1
      ) {
        throw new e.LastAdminRequired.Error();
      }

      throw new e.UserDeleteNotImplemented.Error();
    },
  )
  .get('/oauth-clients', verifyAdmin(), async (c) => {
    const clients = await c.var.services.mikro.oauthClient.find(
      {},
      { orderBy: { created_at: 'ASC' } },
    );

    return c.json({ oauth_clients: clients.map(serializeOAuthClient) }, 200);
  })
  .get(
    '/oauth-clients/:id',
    validator('param', OAuthClientParamsSchema),
    verifyAdmin(),
    async (c) => {
      const params = c.req.valid('param');
      const client = await findOAuthClientOrFail(c.var.services, params.id);

      return c.json({ oauth_client: serializeOAuthClient(client) }, 200);
    },
  )
  .post(
    '/oauth-clients',
    validator('json', CreateOAuthClientSchema),
    verifyAdmin(),
    async (c) => {
      const body = c.req.valid('json');
      const { user: actor } = c.var.verifiedAdmin;
      const clientSecretHash = body.client_secret
        ? await c.var.services.securityService.hashClientSecret(
            body.client_secret,
          )
        : null;
      const client = c.var.services.mikro.oauthClient.create({
        id: body.id,
        clientId: body.client_id,
        clientSecretHash,
        name: body.name,
        redirectUris: body.redirect_uris,
        responseTypes: body.response_types,
        grantTypes: body.grant_types,
        scopes: body.scope.split(' ').filter((scope) => scope.length > 0),
        enabled: body.enabled ?? true,
        managed_by: 'database',
        logoUri: body.logo_uri ?? null,
      });

      await c.var.services.mikro.em.persist(client).flush();
      await c.var.services.adminAuditService.record({
        actorSub: actor.sub,
        action: 'admin.oauth_client.create',
        targetType: 'oauth_client',
        targetId: client.id,
        metadata: { after: serializeOAuthClient(client) },
        ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
      });

      return c.json({ oauth_client: serializeOAuthClient(client) }, 201);
    },
  )
  .patch(
    '/oauth-clients/:id',
    validator('param', OAuthClientParamsSchema),
    validator('json', UpdateOAuthClientSchema),
    verifyAdmin(),
    async (c) => {
      const params = c.req.valid('param');
      const body = c.req.valid('json');
      const { user: actor } = c.var.verifiedAdmin;
      const client = await findOAuthClientOrFail(c.var.services, params.id);

      if (client.managed_by === 'config') {
        throw new e.OAuthClientNotEditable.Error();
      }

      const before = serializeOAuthClient(client);

      if (body.name !== undefined) {
        client.name = body.name;
      }
      if (body.redirect_uris !== undefined) {
        client.redirectUris = body.redirect_uris;
      }
      if (body.response_types !== undefined) {
        client.responseTypes = body.response_types;
      }
      if (body.grant_types !== undefined) {
        client.grantTypes = body.grant_types;
      }
      if (body.scope !== undefined) {
        client.scopes = body.scope
          .split(' ')
          .filter((scope) => scope.length > 0);
      }
      if (body.enabled !== undefined) {
        client.enabled = body.enabled;
      }
      if (body.logo_uri !== undefined) {
        client.logoUri = body.logo_uri;
      }

      await c.var.services.mikro.em.flush();
      await c.var.services.adminAuditService.record({
        actorSub: actor.sub,
        action: 'admin.oauth_client.update',
        targetType: 'oauth_client',
        targetId: client.id,
        metadata: { before, after: serializeOAuthClient(client) },
        ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
      });

      return c.json({ oauth_client: serializeOAuthClient(client) }, 200);
    },
  )
  .delete(
    '/oauth-clients/:id',
    validator('param', OAuthClientParamsSchema),
    verifyAdmin(),
    async (c) => {
      const params = c.req.valid('param');
      const { user: actor } = c.var.verifiedAdmin;
      const client = await findOAuthClientOrFail(c.var.services, params.id);

      if (client.managed_by === 'config') {
        throw new e.OAuthClientNotEditable.Error();
      }

      const before = serializeOAuthClient(client);
      c.var.services.mikro.em.remove(client);
      await c.var.services.mikro.em.flush();
      await c.var.services.adminAuditService.record({
        actorSub: actor.sub,
        action: 'admin.oauth_client.delete',
        targetType: 'oauth_client',
        targetId: client.id,
        metadata: { before },
        ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
      });

      return c.body(null, 204);
    },
  )
  .get(
    '/audit-events',
    validator('query', AuditEventsQuerySchema),
    verifyAdmin(),
    async (c) => {
      const query = c.req.valid('query');
      const { events, total } =
        await c.var.services.adminAuditService.listRecent(query);

      return c.json(
        {
          audit_events: events.map(serializeAdminAuditEvent),
          pagination: {
            limit: query.limit,
            offset: query.offset,
            total,
          },
        },
        200,
      );
    },
  );
