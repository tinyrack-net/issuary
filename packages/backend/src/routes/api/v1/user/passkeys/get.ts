import { createRoute, z } from '@hono/zod-openapi';
import { createRouter } from '@/lib/create-router.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';

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

export default createRouter().openapi(route, async (c) => {
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
