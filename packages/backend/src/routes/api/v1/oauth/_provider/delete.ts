import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'DELETE',
    url: '/oauth/:provider',
    schema: {
      summary: 'Unlink OAuth Account',
      description: 'Unlinks an OAuth provider from the current user',
      tags: [TAGS.OAUTH_CONNECT],
      params: z.object({
        provider: f.providerName,
      }),
      response: {
        200: r.OkResponse,
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

      return res.status(200).send({ ok: true });
    },
  });
