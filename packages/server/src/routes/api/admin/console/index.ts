import { Hono } from 'hono';
import { validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { isSecureRedirectUri } from '../../../../lib/config/url-policy.ts';
import { requireAdmin } from '../../../../middleware/auth.ts';

const QueryBoolean = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}, z.boolean());

const PaginationQuery = z.object({
  query: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  managed_by: z.enum(['database', 'config']).optional(),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

const ClientQuery = PaginationQuery.extend({
  lifecycle_status: z.enum(['active', 'inactive', 'deleted']).optional(),
  type: z.enum(['public', 'confidential']).optional(),
});

const ClientBody = z.object({
  client_id: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
  type: z.enum(['public', 'confidential']),
  redirect_uris: z.array(z.string().refine(isSecureRedirectUri)).min(1),
  post_logout_redirect_uris: z
    .array(z.string().refine(isSecureRedirectUri))
    .default([]),
  web_origins: z.array(z.url()).default([]),
  grant_types: z.array(z.string().min(1)).min(1),
  response_types: z.array(z.string().min(1)).min(1),
  scopes: z.array(z.string().min(1)).min(1),
  skip_consent: z.boolean().default(false),
});

const ClientUpdateBody = ClientBody.omit({ client_id: true, type: true });

const TermContentBody = z
  .object({
    lang: z.enum(['ko', 'en', 'ja']),
    title: z.string().trim().min(1).max(255),
    type: z.enum(['link', 'text']),
    content: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (value.type !== 'link') return;
    const parsed = z.url().safeParse(value.content);
    if (!parsed.success) {
      context.addIssue({
        code: 'custom',
        path: ['content'],
        message: 'Link content must be a valid URL',
      });
    }
  });

const TermBody = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
  required: z.boolean(),
  consent_mode: z.enum(['explicit', 'implicit']),
  version: z.string().trim().min(1).max(100),
  contents: z
    .array(TermContentBody)
    .min(1)
    .refine(
      (contents) =>
        new Set(contents.map((content) => content.lang)).size ===
        contents.length,
      { message: 'Each language can be provided only once' },
    ),
});

const TermQuery = PaginationQuery.extend({
  required: QueryBoolean.optional(),
  consent_mode: z.enum(['explicit', 'implicit']).optional(),
  archived: QueryBoolean.optional(),
});

const ClientFilter = z.object({
  query: z.string().optional(),
  managed_by: z.enum(['database', 'config']).optional(),
  enabled: z.boolean().optional(),
});

const TermFilter = z.object({
  query: z.string().optional(),
  managed_by: z.enum(['database', 'config']).optional(),
  archived: z.boolean().optional(),
});

const bulkBody = <T extends z.ZodType>(filter: T) =>
  z.object({
    target: z.union([
      z.object({
        kind: z.literal('ids'),
        ids: z.array(z.string().min(1)).min(1).max(100),
      }),
      z.object({ kind: z.literal('filter'), filter }),
    ]),
    active: z.boolean(),
  });

function clientInput(body: z.infer<typeof ClientBody>) {
  return {
    clientId: body.client_id,
    name: body.name,
    type: body.type,
    redirectUris: body.redirect_uris,
    postLogoutRedirectUris: body.post_logout_redirect_uris,
    webOrigins: body.web_origins,
    grantTypes: body.grant_types,
    responseTypes: body.response_types,
    scopes: body.scopes,
    skipConsent: body.skip_consent,
  };
}

function clientUpdateInput(body: z.infer<typeof ClientUpdateBody>) {
  return {
    name: body.name,
    redirectUris: body.redirect_uris,
    postLogoutRedirectUris: body.post_logout_redirect_uris,
    webOrigins: body.web_origins,
    grantTypes: body.grant_types,
    responseTypes: body.response_types,
    scopes: body.scopes,
    skipConsent: body.skip_consent,
  };
}

function termInput(body: z.infer<typeof TermBody>) {
  return {
    id: body.id,
    required: body.required,
    consentMode: body.consent_mode,
    version: body.version,
    contents: body.contents,
  };
}

export const adminConsoleRoutes = new Hono<AppEnv>()
  .get('/admin/overview', requireAdmin(), async (c) =>
    c.json(await c.var.services.adminConsoleService.overview(), 200),
  )
  .get(
    '/admin/search',
    requireAdmin(),
    validator('query', z.object({ q: z.string().trim().min(1).max(100) })),
    async (c) =>
      c.json(
        await c.var.services.adminConsoleService.search(c.req.valid('query').q),
        200,
      ),
  )
  .get('/admin/system', requireAdmin(), async (c) =>
    c.json(c.var.services.adminConsoleService.system(), 200),
  )
  .get(
    '/admin/clients',
    requireAdmin(),
    validator('query', ClientQuery),
    async (c) => {
      const query = c.req.valid('query');
      return c.json(
        await c.var.services.adminConsoleService.listClients({
          query: query.query,
          page: query.page,
          pageSize: query.page_size,
          managedBy: query.managed_by,
          lifecycleStatus: query.lifecycle_status,
          type: query.type,
          direction: query.direction,
        }),
        200,
      );
    },
  )
  .post(
    '/admin/clients',
    requireAdmin(),
    validator('json', ClientBody),
    async (c) =>
      c.json(
        await c.var.services.adminConsoleService.createClient(
          clientInput(c.req.valid('json')),
        ),
        201,
      ),
  )
  .post(
    '/admin/clients/bulk-status',
    requireAdmin(),
    validator('json', bulkBody(ClientFilter)),
    async (c) => {
      const body = c.req.valid('json');
      const ids = body.target.kind === 'ids' ? body.target.ids : undefined;
      const filter =
        body.target.kind === 'filter'
          ? {
              query: body.target.filter.query,
              managedBy: body.target.filter.managed_by,
              enabled: body.target.filter.enabled,
              page: 1,
              pageSize: 100,
            }
          : undefined;
      return c.json(
        await c.var.services.adminConsoleService.setClientsEnabled(
          ids,
          filter,
          body.active,
        ),
        200,
      );
    },
  )
  .patch(
    '/admin/clients/:id',
    requireAdmin(),
    validator('json', ClientUpdateBody),
    async (c) => {
      const result = await c.var.services.adminConsoleService.updateClient(
        c.req.param('id'),
        clientUpdateInput(c.req.valid('json')),
      );
      return result ? c.json(result, 200) : c.json({ error: 'Not Found' }, 404);
    },
  )
  .post('/admin/clients/:id/rotate-secret', requireAdmin(), async (c) => {
    const result = await c.var.services.adminConsoleService.rotateClientSecret(
      c.req.param('id'),
    );
    return result ? c.json(result, 200) : c.json({ error: 'Not Found' }, 404);
  })
  .delete('/admin/clients/:id', requireAdmin(), async (c) => {
    const result = await c.var.services.adminConsoleService.deleteClient(
      c.req.param('id'),
    );
    return result ? c.json(result, 200) : c.json({ error: 'Not Found' }, 404);
  })
  .post('/admin/clients/:id/restore', requireAdmin(), async (c) => {
    const result = await c.var.services.adminConsoleService.restoreClient(
      c.req.param('id'),
    );
    return result ? c.json(result, 200) : c.json({ error: 'Not Found' }, 404);
  })
  .get(
    '/admin/terms',
    requireAdmin(),
    validator('query', TermQuery),
    async (c) => {
      const query = c.req.valid('query');
      return c.json(
        await c.var.services.adminConsoleService.listTerms({
          query: query.query,
          page: query.page,
          pageSize: query.page_size,
          managedBy: query.managed_by,
          required: query.required,
          consentMode: query.consent_mode,
          archived: query.archived,
          direction: query.direction,
        }),
        200,
      );
    },
  )
  .post(
    '/admin/terms',
    requireAdmin(),
    validator('json', TermBody),
    async (c) =>
      c.json(
        await c.var.services.adminConsoleService.createTerm(
          termInput(c.req.valid('json')),
        ),
        201,
      ),
  )
  .post(
    '/admin/terms/bulk-status',
    requireAdmin(),
    validator('json', bulkBody(TermFilter)),
    async (c) => {
      const body = c.req.valid('json');
      const ids = body.target.kind === 'ids' ? body.target.ids : undefined;
      const filter =
        body.target.kind === 'filter'
          ? {
              query: body.target.filter.query,
              managedBy: body.target.filter.managed_by,
              page: 1,
              pageSize: 100,
            }
          : undefined;
      return c.json(
        await c.var.services.adminConsoleService.setTermsArchived(
          ids,
          filter,
          !body.active,
        ),
        200,
      );
    },
  )
  .patch(
    '/admin/terms/:id',
    requireAdmin(),
    validator('json', TermBody.omit({ id: true })),
    async (c) => {
      const body = c.req.valid('json');
      const result = await c.var.services.adminConsoleService.updateTerm(
        c.req.param('id'),
        {
          required: body.required,
          consentMode: body.consent_mode,
          version: body.version,
          contents: body.contents,
        },
      );
      return result ? c.json(result, 200) : c.json({ error: 'Not Found' }, 404);
    },
  );
