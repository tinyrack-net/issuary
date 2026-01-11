import z from 'zod';
import { e } from '@/schemas/error.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'DELETE',
    url: '',
    schema: {
      summary: 'Unlink OAuth Account',
      description: 'Unlinks an OAuth provider from the current user',
      tags: ['OAuth Connect'],
      params: z.object({
        provider: z.string().min(1),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
        }),
        400: e.CannotUnlinkLastAuthMethod.Schema,
        401: e.Unauthorized.Schema,
        404: z.union([
          e.OAuthProviderNotFound.Schema,
          e.OAuthAccountNotLinked.Schema,
          e.UserNotFound.Schema,
        ]),
      },
    },
    handler: async (req, res) => {
      // Check if user is logged in
      const userSession = await req.auth.verify();

      const { provider } = req.params;

      // Verify provider exists
      fastify.oauthConnectService.getProvider(provider);

      // Unlink the OAuth account
      await fastify.oauthConnectService.unlinkOAuthAccount(
        userSession.id,
        provider,
      );

      return res.status(200).send({ success: true });
    },
  });
