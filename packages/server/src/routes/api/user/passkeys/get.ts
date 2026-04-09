import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../lib/openapi.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../middleware/auth.ts';
import { e } from '../../../../schemas/error.ts';
import { r } from '../../../../schemas/response.ts';

export const userPasskeysGet = new Hono<AppEnv>().get(
  '/user/passkeys',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Get Passkeys',
    description: 'Get all passkeys for the current user',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                passkeys: z.array(r.PasskeyInfo),
              }),
            ),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.PasskeyNotEnabled.Schema),
          },
        },
        description: 'Passkey authentication is disabled',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
    },
  }),
  verifyAuth(),
  async (c) => {
    const config = c.var.services.config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const { user: userEntity } = c.var.verifiedUser;
    const { passkeyService } = c.var.services;
    const passkeys = await passkeyService.getUserPasskeys(userEntity.sub);

    return c.json({ passkeys }, 200);
  },
);
