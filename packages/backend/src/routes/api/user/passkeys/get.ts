import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
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
  async (c) => {
    const config = c.get('services').config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const auth = c.get('auth');
    const { passkeyService } = c.get('services');

    const userSession = await auth.verify();
    const passkeys = await passkeyService.getUserPasskeys(userSession.id);

    return c.json({ passkeys }, 200);
  },
);
