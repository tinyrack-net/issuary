import z from 'zod/v4';
import { parseScopesWithDescriptions } from '@/lib/scopes.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * GET /api/v1/oauth/consent
 *
 * Returns consent page data including client information and requested scopes.
 * Used by the frontend consent page to display consent details.
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '/consent',
    schema: {
      summary: 'Get consent information',
      description:
        'Returns OAuth client information and requested scopes for the consent page.',
      tags: [TAGS.CONSENT],
      querystring: z.object({
        client_id: f.clientId,
        scope: f.scope.optional(),
      }),
      response: {
        200: r.ConsentInfoResponse,
        400: e.OAuthClientNotFound.Schema,
        401: e.Unauthorized.Schema,
      },
    },
    handler: async (req, res) => {
      const { client_id, scope } = req.query;

      // Check if user is logged in
      const userSession = await req.auth.verify();

      // Fetch user information
      const userEntity = await fastify.mikro.user.verifyById(userSession.id);
      const user =
        await fastify.userService.userEntityToSessionUser(userEntity);

      // Fetch OAuth client information
      const client = await fastify.oauthClientService.findByClientId(client_id);

      // Parse requested scopes with descriptions
      const scopes = parseScopesWithDescriptions(scope);

      return res.status(200).send({
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
      });
    },
  });
};
