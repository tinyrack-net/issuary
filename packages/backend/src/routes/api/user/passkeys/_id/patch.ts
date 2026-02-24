import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '#backend/lib/app-env.js';
import { OPENAPI_SECURITY } from '#backend/lib/openapi.js';
import { TAGS } from '#backend/lib/swagger-tags.js';
import { verifyAuth } from '#backend/middleware/auth.js';
import { e } from '#backend/schemas/error.js';
import { f } from '#backend/schemas/field.js';
import { r } from '#backend/schemas/response.js';

export const userPasskeyIdPatch = new Hono<AppEnv>().patch(
  '/user/passkeys/:id',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Rename Passkey',
    description: 'Rename a passkey',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(r.OkResponse) },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.PasskeyNotEnabled.Schema),
          },
        },
        description: 'Passkey not enabled',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
      404: {
        content: {
          'application/json': {
            schema: resolver(e.PasskeyNotFound.Schema),
          },
        },
        description: 'Passkey not found',
      },
    },
  }),
  validator(
    'param',
    z.object({
      id: f.uuid,
    }),
  ),
  validator(
    'json',
    z.object({
      name: f.passkeyName,
    }),
  ),
  verifyAuth(),
  async (c) => {
    const config = c.var.services.config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const params = c.req.valid('param');
    const body = c.req.valid('json');
    const { user: userEntity } = c.var.verifiedUser;
    const { passkeyService } = c.var.services;

    // Rename passkey
    await passkeyService.renamePasskey(userEntity.sub, params.id, body.name);

    return c.json({ ok: true as const }, 200);
  },
);
