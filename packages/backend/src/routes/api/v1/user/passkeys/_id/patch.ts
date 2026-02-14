import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { createRoute, z } from '@hono/zod-openapi';

const route = createRoute({
  method: 'patch',
  path: '/user/passkeys/{id}',
  tags: [TAGS.USER],
  summary: 'Rename Passkey',
  description: 'Rename a passkey',
  request: {
    params: z.object({
      id: f.uuid,
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: f.passkeyName,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: r.OkResponse },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.PasskeyNotEnabled.Schema,
        },
      },
      description: 'Passkey not enabled',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
    404: {
      content: {
        'application/json': {
          schema: e.PasskeyNotFound.Schema,
        },
      },
      description: 'Passkey not found',
    },
  },
});

export const userPasskeyIdPatch = createRouter().openapi(route, async (c) => {
  const config = c.get('services').config;
  if (!config.auth.passkey.enabled) {
    throw new e.PasskeyNotEnabled.Error();
  }

  const params = c.req.valid('param');
  const body = c.req.valid('json');
  const auth = c.get('auth');
  const { passkeyService } = c.get('services');

  const userSession = await auth.verify();

  // Rename passkey
  await passkeyService.renamePasskey(userSession.id, params.id, body.name);

  return c.json({ ok: true as const }, 200);
});
