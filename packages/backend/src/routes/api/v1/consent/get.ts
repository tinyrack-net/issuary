import z from 'zod/v4';
import { e } from '@/schemas/error.js';
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
    url: '',
    schema: {
      summary: 'Get consent information',
      description:
        'Returns OAuth client information and requested scopes for the consent page.',
      tags: ['Consent'],
      querystring: z.object({
        client_id: z
          .string()
          .min(1)
          .max(1000)
          .describe('OAuth client ID requesting authorization'),
        scope: z
          .string()
          .max(1000)
          .optional()
          .describe('Space-delimited list of requested scopes'),
      }),
      response: {
        200: z.object({
          client: z.object({
            id: z.string(),
            clientId: z.string(),
            name: z.string(),
          }),
          scopes: z.array(
            z.object({
              name: z.string(),
              description: z.string(),
            }),
          ),
          user: z.object({
            id: z.string(),
            email: z.string(),
          }),
        }),
        400: e.OAuthClientNotFound.Schema,
        401: z.object({
          code: z.string(),
          message: z.string(),
        }),
      },
    },
    handler: async (req, res) => {
      const { client_id, scope } = req.query;

      // Check if user is logged in
      const userSession = await req.auth.verify();

      // Fetch user information
      const user = await fastify.userService.verifyUserById(userSession.id);

      // Fetch OAuth client information
      const client = await fastify.oauthClientService.findByClientId(client_id);

      // Parse requested scopes
      const requestedScopes = scope ? scope.split(' ') : [];

      // Map scopes to their descriptions
      const scopeDescriptions: Record<string, string> = {
        openid: 'Access your unique user identifier',
        profile: 'Access your profile information (name, picture, etc.)',
        email: 'Access your email address',
        address: 'Access your address information',
        phone: 'Access your phone number',
        offline_access: 'Maintain access when you are not present',
      };

      const scopes = requestedScopes.map((scopeName) => ({
        name: scopeName,
        description:
          scopeDescriptions[scopeName] || `Access to ${scopeName} data`,
      }));

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
