import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { createRoute, z } from '@hono/zod-openapi';

const route = createRoute({
  method: 'delete',
  path: '/oauth/{provider}',
  tags: [TAGS.OAUTH_CONNECT],
  summary: 'Unlink OAuth Account',
  description: 'Unlinks an OAuth provider from the current user',
  request: {
    params: z.object({
      provider: f.providerName,
    }),
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
          schema: e.CannotUnlinkLastAuthMethod.Schema,
        },
      },
      description: 'Cannot unlink last auth method',
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
          schema: e.OAuthProviderNotFound.Schema,
        },
      },
      description:
        'OAuth provider not found, account not linked, or user not found',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const params = c.req.valid('param');
  const auth = c.get('auth');
  const { oauthConnectService } = c.get('services');

  // Check if user is logged in
  const userSession = await auth.verify();

  const { provider } = params;

  // Verify provider exists
  oauthConnectService.getProvider(provider);

  // Unlink the OAuth account
  await oauthConnectService.unlinkOAuthAccount(userSession.id, provider);

  return c.json({ ok: true as const }, 200);
});
