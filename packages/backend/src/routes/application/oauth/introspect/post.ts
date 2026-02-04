import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Token Introspection',
      description:
        'OAuth2 Token Introspection Endpoint - Returns metadata about tokens (RFC 7662)',
      tags: [TAGS.OPENID],
      body: z.object({
        token: f.token,
        token_type_hint: f.tokenTypeHint.optional(),
        client_id: f.clientId.optional(),
        client_secret: f.clientSecret.optional(),
      }),
      response: {
        200: r.IntrospectionResponse,
        400: z.union([
          e.OAuthClientNotFound.Schema,
          e.OAuthClientDisabled.Schema,
        ]),
        401: e.InvalidClientCredentials.Schema,
      },
    },
    handler: async (req, res) => {
      const { body } = req;

      // 1. Validate client credentials if provided (RFC 7662 §2.1)
      // Client authentication is optional but recommended
      if (body.client_id) {
        const client = await fastify.oauthClientService.findByClientId(
          body.client_id,
        );

        if (!client.enabled) {
          throw new e.OAuthClientDisabled.Error();
        }

        // 2. Validate client secret if provided
        if (body.client_secret) {
          const isValid = await fastify.oauthClientService.verifyClientSecret(
            body.client_id,
            body.client_secret,
          );
          if (!isValid) {
            throw new e.InvalidClientCredentials.Error();
          }
        }
      }

      // 3. Introspect the token (RFC 7662 §2.2)
      const result = await fastify.oauthTokenService.introspectToken(
        body.token,
        body.token_type_hint,
      );

      return res.status(200).send(result);
    },
  });
};
