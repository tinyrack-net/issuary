import { createRoute, z } from '@hono/zod-openapi';
import type { AppType } from '@/lib/app.js';
import { parseScopesWithDescriptions } from '@/lib/scopes.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';

/**
 * GET /api/v1/oauth/consent
 *
 * Returns consent page data including client information and requested scopes.
 * Used by the frontend consent page to display consent details.
 */
const route = createRoute({
  method: 'get',
  path: '/consent',
  tags: [TAGS.CONSENT],
  summary: 'Get consent information',
  description:
    'Returns OAuth client information and requested scopes for the consent page.',
  request: {
    query: z.object({
      client_id: f.clientId,
      scope: f.scope.optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.ConsentInfoResponse,
        },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.OAuthClientNotFound.Schema,
        },
      },
      description: 'OAuth client not found',
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
    const query = c.req.valid('query');
    const { client_id, scope } = query;
    const auth = c.get('auth');
    const { mikro, userService, oauthClientService } = c.get('services');

    // Check if user is logged in
    const userSession = await auth.verify();

    // Fetch user information
    const userEntity = await mikro.user.verifyById(userSession.id);
    const user = await userService.userEntityToSessionUser(userEntity);

    // Fetch OAuth client information
    const client = await oauthClientService.findByClientId(client_id);

    // Parse requested scopes with descriptions
    const scopes = parseScopesWithDescriptions(scope);

    return c.json(
      {
        client: {
          id: client.id,
          clientId: client.clientId,
          name: client.name,
        },
        scopes,
        user: {
          id: user.id,
          email: user.email,
        },
      },
      200,
    );
  });
};
