import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';

export const userPasskeysGet = new Hono<AppEnv>().get(
  '/user/passkeys',
  describeRoute({
    tags: [TAGS.USER],
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
