import { createRoute } from '@hono/zod-openapi';
import z from 'zod';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

const route = createRoute({
  method: 'get',
  path: '/user/passkeys',
  tags: [TAGS.USER],
  summary: 'Get Passkeys',
  description: 'Get all passkeys for the current user',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            passkeys: z.array(r.PasskeyInfo),
          }),
        },
      },
      description: 'Success',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const config = c.get('services').config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const auth = c.get('auth');
    const { passkeyService } = c.get('services');

    const userSession = await auth.verify();
    const passkeys = await passkeyService.getUserPasskeys(userSession.id);

    return c.json({ passkeys }, 200);
  });
};
