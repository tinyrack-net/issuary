import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../../lib/openapi.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../../middleware/auth.ts';
import { e } from '../../../../../schemas/error.ts';
import { f } from '../../../../../schemas/field.ts';
import { r } from '../../../../../schemas/response.ts';

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
