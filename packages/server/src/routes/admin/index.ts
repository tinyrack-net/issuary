import { Hono } from 'hono';
import { validator } from 'hono-openapi';
import { z } from 'zod';
import type { IOAuthClientEntity } from '../../entities/oauth-client.entity.ts';
import type { IOAuthProviderEntity } from '../../entities/oauth-provider.entity.ts';
import type { UserEntity } from '../../entities/user.entity.ts';
import type { AppEnv } from '../../lib/app-env.ts';
import type { IdentityProviderConfig } from '../../lib/config/index.ts';
import {
  isHttpsOrLocalHttpUrl,
  isSecureRedirectUri,
} from '../../lib/config/url-policy.ts';
import { verifyAdmin } from '../../middleware/admin-auth.ts';
import { e } from '../../schemas/error.ts';
import type { ServiceContainer } from '../../services/container.ts';

const UserParamsSchema = z.object({
  sub: z.string().min(1),
});

const OAuthClientParamsSchema = z.object({
  id: z.string().min(1),
});

const OAuthProviderParamsSchema = z.object({
  id: z.string().min(1),
});

const AdminPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
});

const RedirectUriSchema = z.string().refine(isSecureRedirectUri, {
  message:
    'Redirect URI must use HTTPS or local HTTP and must not contain fragments or wildcards.',
});

const SecureEndpointUrlSchema = z.string().refine(isHttpsOrLocalHttpUrl, {
  message: 'URL must use HTTPS or local HTTP.',
});

const NullableSecureEndpointUrlSchema = SecureEndpointUrlSchema.nullable();

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

const UserinfoMappingSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().min(1),
    email_verified: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    picture: z.string().min(1).optional(),
  })
  .strict();

const OAuthProviderBaseShape = {
  type: z.enum(['github', 'google', 'apple', 'generic_oauth']),
  issuer: NullableSecureEndpointUrlSchema,
  display_name: z.string().min(1).max(255),
  icon_url: NullableSecureEndpointUrlSchema,
  client_id: z.string().min(1).max(255),
  scopes: z.array(z.string().min(1)).min(1),
  authorization_url: SecureEndpointUrlSchema,
  token_url: SecureEndpointUrlSchema,
  userinfo_url: NullableSecureEndpointUrlSchema,
  jwks_url: NullableSecureEndpointUrlSchema,
  email_url: NullableSecureEndpointUrlSchema,
  response_mode: z.enum(['query', 'fragment', 'form_post']).nullable(),
  email_conflict_strategy: z.enum(['auto_link', 'require_link']),
  userinfo_mapping: UserinfoMappingSchema,
  enabled: z.boolean().optional(),
};

const OAuthProviderBaseSchema = z
  .object(OAuthProviderBaseShape)
  .strict()
  .superRefine((provider, ctx) => {
    if (
      provider.type === 'generic_oauth' &&
      provider.userinfo_url === null &&
      provider.jwks_url !== null &&
      provider.issuer === null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['issuer'],
        message:
          'Issuer is required for generic ID-token-only providers with JWKS.',
      });
    }
  });

const CreateOAuthProviderSchema = OAuthProviderBaseSchema.extend({
  id: z.string().min(1).max(255),
  client_secret: z.string().min(1),
}).strict();

const UpdateOAuthProviderSchema = z
  .object(OAuthProviderBaseShape)
  .partial()
  .extend({ client_secret: z.string().min(1).optional() })
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

type SerializedOAuthProvider = {
  id: string;
  type: 'github' | 'google' | 'apple' | 'generic_oauth';
  issuer: string | null;
  display_name: string;
  icon_url: string | null;
  client_id: string;
  has_client_secret: boolean;
  scopes: string[];
  authorization_url: string;
  token_url: string;
  userinfo_url: string | null;
  jwks_url: string | null;
  email_url: string | null;
  response_mode: 'query' | 'fragment' | 'form_post' | null;
  email_conflict_strategy: 'auto_link' | 'require_link';
  userinfo_mapping: {
    id: string;
    email: string;
    email_verified?: string | undefined;
    name?: string | undefined;
    picture?: string | undefined;
  };
  enabled: boolean;
  managed_by: 'database' | 'config';
  created_at: string;
  updated_at: string;
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

function serializeResponseMode(
  responseMode: string | null | undefined,
): SerializedOAuthProvider['response_mode'] {
  if (
    responseMode === 'query' ||
    responseMode === 'fragment' ||
    responseMode === 'form_post'
  ) {
    return responseMode;
  }

  return null;
}

function serializeConfigOAuthProvider(
  provider: IdentityProviderConfig,
): SerializedOAuthProvider {
  const now = new Date(0).toISOString();

  return {
    id: provider.id,
    type: provider.type,
    issuer: provider.issuer ?? null,
    display_name: provider.display_name,
    icon_url: provider.icon_url ?? null,
    client_id: provider.client_id,
    has_client_secret: provider.client_secret.length > 0,
    scopes: provider.scopes,
    authorization_url: provider.authorization_url,
    token_url: provider.token_url,
    userinfo_url: provider.userinfo_url,
    jwks_url: provider.jwks_url ?? null,
    email_url: provider.email_url ?? null,
    response_mode: serializeResponseMode(provider.response_mode),
    email_conflict_strategy: provider.email_conflict_strategy,
    userinfo_mapping: provider.userinfo_mapping,
    enabled: provider.enabled,
    managed_by: 'config',
    created_at: now,
    updated_at: now,
  };
}

function serializeDatabaseOAuthProvider(
  provider: IOAuthProviderEntity,
): SerializedOAuthProvider {
  return {
    id: provider.id,
    type: provider.type,
    issuer: provider.issuer ?? null,
    display_name: provider.displayName,
    icon_url: provider.iconUrl ?? null,
    client_id: provider.clientId,
    has_client_secret: provider.clientSecretEncrypted.length > 0,
    scopes: provider.scopes,
    authorization_url: provider.authorizationUrl,
    token_url: provider.tokenUrl,
    userinfo_url: provider.userinfoUrl ?? null,
    jwks_url: provider.jwksUrl ?? null,
    email_url: provider.emailUrl ?? null,
    response_mode: serializeResponseMode(provider.responseMode),
    email_conflict_strategy: provider.emailConflictStrategy,
    userinfo_mapping: provider.userinfoMapping,
    enabled: provider.enabled,
    managed_by: 'database',
    created_at: provider.created_at.toISOString(),
    updated_at: provider.updated_at.toISOString(),
  };
}

function filterSerializedOAuthProviders(
  providers: SerializedOAuthProvider[],
  search: string | undefined,
) {
  if (!search) {
    return providers;
  }

  const normalizedSearch = search.toLowerCase();
  return providers.filter((provider) => {
    return [provider.id, provider.display_name, provider.client_id].some(
      (value) => value.toLowerCase().includes(normalizedSearch),
    );
  });
}

function sortSerializedOAuthProviders(providers: SerializedOAuthProvider[]) {
  return providers.toSorted((left, right) => {
    const displayNameComparison = left.display_name.localeCompare(
      right.display_name,
    );
    if (displayNameComparison !== 0) {
      return displayNameComparison;
    }

    return left.id.localeCompare(right.id);
  });
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

async function findOAuthProviderOrFail(services: ServiceContainer, id: string) {
  return services.mikro.oauthProvider.findOneOrFail(
    { id },
    { failHandler: () => new e.OAuthProviderNotFound.Error() },
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
  .get(
    '/users',
    validator('query', AdminPaginationQuerySchema),
    verifyAdmin(),
    async (c) => {
      const query = c.req.valid('query');
      const where = query.search
        ? {
            deleted_at: null,
            $or: [
              { email: { $like: `%${query.search}%` } },
              { sub: { $like: `%${query.search}%` } },
            ],
          }
        : { deleted_at: null };
      const [users, total] = await c.var.services.mikro.user.findAndCount(
        where,
        {
          limit: query.limit,
          offset: query.offset,
          orderBy: { email: 'ASC' },
        },
      );

      return c.json(
        {
          items: users.map(serializeAdminUser),
          pagination: {
            limit: query.limit,
            offset: query.offset,
            total,
          },
        },
        200,
      );
    },
  )
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

      if (body.role !== undefined) {
        user.role = body.role;
      }
      if (body.email_verified !== undefined) {
        user.email_verified = body.email_verified;
      }

      await c.var.services.mikro.em.flush();

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
  .get(
    '/oauth-providers',
    validator('query', AdminPaginationQuerySchema),
    verifyAdmin(),
    async (c) => {
      const query = c.req.valid('query');
      const providers = await c.var.services.oauthConnectService
        .getAllProvidersForAdmin()
        .then((items) =>
          items.map((item) =>
            item.managed_by === 'config'
              ? serializeConfigOAuthProvider(item.provider)
              : serializeDatabaseOAuthProvider(item.provider),
          ),
        );
      const filteredProviders = filterSerializedOAuthProviders(
        sortSerializedOAuthProviders(providers),
        query.search,
      );
      const pagedProviders = filteredProviders.slice(
        query.offset,
        query.offset + query.limit,
      );

      return c.json(
        {
          items: pagedProviders,
          pagination: {
            limit: query.limit,
            offset: query.offset,
            total: filteredProviders.length,
          },
        },
        200,
      );
    },
  )
  .get(
    '/oauth-providers/:id',
    validator('param', OAuthProviderParamsSchema),
    verifyAdmin(),
    async (c) => {
      const params = c.req.valid('param');
      const item = await c.var.services.oauthConnectService.getProviderForAdmin(
        params.id,
      );

      return c.json(
        {
          oauth_provider:
            item.managed_by === 'config'
              ? serializeConfigOAuthProvider(item.provider)
              : serializeDatabaseOAuthProvider(item.provider),
        },
        200,
      );
    },
  )
  .post(
    '/oauth-providers',
    validator('json', CreateOAuthProviderSchema),
    verifyAdmin(),
    async (c) => {
      const body = c.req.valid('json');
      const configProviderIds =
        c.var.services.oauthConnectService.getConfigProviderIds();

      if (configProviderIds.has(body.id)) {
        throw new e.OAuthProviderAlreadyExists.Error();
      }

      const existingProvider = await c.var.services.mikro.oauthProvider.findOne(
        { id: body.id },
      );
      if (existingProvider) {
        throw new e.OAuthProviderAlreadyExists.Error();
      }

      const provider = c.var.services.mikro.oauthProvider.create({
        id: body.id,
        type: body.type,
        issuer: body.issuer,
        displayName: body.display_name,
        iconUrl: body.icon_url,
        clientId: body.client_id,
        clientSecretEncrypted:
          await c.var.services.securityService.encryptProviderSecret(
            body.client_secret,
          ),
        scopes: body.scopes,
        authorizationUrl: body.authorization_url,
        tokenUrl: body.token_url,
        userinfoUrl: body.userinfo_url,
        jwksUrl: body.jwks_url,
        emailUrl: body.email_url,
        responseMode: body.response_mode,
        emailConflictStrategy: body.email_conflict_strategy,
        userinfoMapping: body.userinfo_mapping,
        enabled: body.enabled ?? true,
      });

      await c.var.services.mikro.em.persist(provider).flush();

      return c.json(
        { oauth_provider: serializeDatabaseOAuthProvider(provider) },
        201,
      );
    },
  )
  .patch(
    '/oauth-providers/:id',
    validator('param', OAuthProviderParamsSchema),
    validator('json', UpdateOAuthProviderSchema),
    verifyAdmin(),
    async (c) => {
      const params = c.req.valid('param');
      const body = c.req.valid('json');

      if (c.var.services.oauthConnectService.getConfigProvider(params.id)) {
        throw new e.OAuthProviderNotEditable.Error();
      }

      const provider = await findOAuthProviderOrFail(c.var.services, params.id);

      if (body.type !== undefined) {
        provider.type = body.type;
      }
      if (body.issuer !== undefined) {
        provider.issuer = body.issuer;
      }
      if (body.display_name !== undefined) {
        provider.displayName = body.display_name;
      }
      if (body.icon_url !== undefined) {
        provider.iconUrl = body.icon_url;
      }
      if (body.client_id !== undefined) {
        provider.clientId = body.client_id;
      }
      if (body.client_secret !== undefined) {
        provider.clientSecretEncrypted =
          await c.var.services.securityService.encryptProviderSecret(
            body.client_secret,
          );
      }
      if (body.scopes !== undefined) {
        provider.scopes = body.scopes;
      }
      if (body.authorization_url !== undefined) {
        provider.authorizationUrl = body.authorization_url;
      }
      if (body.token_url !== undefined) {
        provider.tokenUrl = body.token_url;
      }
      if (body.userinfo_url !== undefined) {
        provider.userinfoUrl = body.userinfo_url;
      }
      if (body.jwks_url !== undefined) {
        provider.jwksUrl = body.jwks_url;
      }
      if (body.email_url !== undefined) {
        provider.emailUrl = body.email_url;
      }
      if (body.response_mode !== undefined) {
        provider.responseMode = body.response_mode;
      }
      if (body.email_conflict_strategy !== undefined) {
        provider.emailConflictStrategy = body.email_conflict_strategy;
      }
      if (body.userinfo_mapping !== undefined) {
        provider.userinfoMapping = body.userinfo_mapping;
      }
      if (body.enabled !== undefined) {
        provider.enabled = body.enabled;
      }

      await c.var.services.mikro.em.flush();

      return c.json(
        { oauth_provider: serializeDatabaseOAuthProvider(provider) },
        200,
      );
    },
  )
  .delete(
    '/oauth-providers/:id',
    validator('param', OAuthProviderParamsSchema),
    verifyAdmin(),
    async (c) => {
      const params = c.req.valid('param');

      if (c.var.services.oauthConnectService.getConfigProvider(params.id)) {
        throw new e.OAuthProviderNotEditable.Error();
      }

      const provider = await findOAuthProviderOrFail(c.var.services, params.id);

      c.var.services.mikro.em.remove(provider);
      await c.var.services.mikro.em.flush();

      return c.body(null, 204);
    },
  )
  .get(
    '/oauth-clients',
    validator('query', AdminPaginationQuerySchema),
    verifyAdmin(),
    async (c) => {
      const query = c.req.valid('query');
      const where = query.search
        ? {
            $or: [
              { id: { $like: `%${query.search}%` } },
              { clientId: { $like: `%${query.search}%` } },
              { name: { $like: `%${query.search}%` } },
            ],
          }
        : {};
      const [clients, total] =
        await c.var.services.mikro.oauthClient.findAndCount(where, {
          limit: query.limit,
          offset: query.offset,
          orderBy: { name: 'ASC', clientId: 'ASC' },
        });

      return c.json(
        {
          items: clients.map(serializeOAuthClient),
          pagination: {
            limit: query.limit,
            offset: query.offset,
            total,
          },
        },
        200,
      );
    },
  )
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
      const configClient = await c.var.services.mikro.oauthClient.findOne({
        managed_by: 'config',
        $or: [{ id: body.id }, { clientId: body.client_id }],
      });

      if (configClient) {
        throw new e.OAuthClientAlreadyExists.Error();
      }

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
      const client = await findOAuthClientOrFail(c.var.services, params.id);

      if (client.managed_by === 'config') {
        throw new e.OAuthClientNotEditable.Error();
      }

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

      return c.json({ oauth_client: serializeOAuthClient(client) }, 200);
    },
  )
  .delete(
    '/oauth-clients/:id',
    validator('param', OAuthClientParamsSchema),
    verifyAdmin(),
    async (c) => {
      const params = c.req.valid('param');
      const client = await findOAuthClientOrFail(c.var.services, params.id);

      if (client.managed_by === 'config') {
        throw new e.OAuthClientNotEditable.Error();
      }

      c.var.services.mikro.em.remove(client);
      await c.var.services.mikro.em.flush();

      return c.body(null, 204);
    },
  );
