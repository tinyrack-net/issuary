import z from 'zod/v4';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { TAGS } from '@/lib/swagger-tags.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * OAuth 2.0 Token Revocation Endpoint (RFC 7009)
 *
 * Allows clients to notify the authorization server that a previously
 * obtained token is no longer needed. The token can be an access token
 * or a refresh token.
 *
 * Per RFC 7009 §2.1:
 * - Returns 200 OK whether the token was successfully revoked or was invalid
 * - Client authentication is optional but recommended for confidential clients
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Token Revocation',
      description:
        'OAuth 2.0 Token Revocation Endpoint - Revokes access or refresh tokens (RFC 7009)',
      tags: [TAGS.OPENID],
      body: z.object({
        token: f.token.describe(
          'The token to revoke. Can be an access token or refresh token.',
        ),
        token_type_hint: f.tokenTypeHint
          .optional()
          .describe(
            'Optional hint about the type of token being revoked. Helps optimize processing.',
          ),
        client_id: f.clientId
          .optional()
          .describe(
            'OAuth client identifier. Optional but recommended for client authentication.',
          ),
        client_secret: f.clientSecret
          .optional()
          .describe(
            'Client secret for confidential clients. Required if client_id is provided for confidential clients.',
          ),
      }),
      response: {
        200: z
          .object({})
          .describe(
            'Token revoked successfully or token was already invalid. Per RFC 7009, returns 200 in both cases.',
          ),
        400: z.union([
          e.OAuthClientNotFound.Schema,
          e.OAuthClientDisabled.Schema,
        ]),
        401: e.InvalidClientCredentials.Schema,
      },
    },
    handler: async (req, res) => {
      const { body } = req;

      // 1. Validate client credentials if provided (RFC 7009 §2.1)
      // Client authentication is optional for public clients
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

      // 3. Revoke the token (RFC 7009 §2.1)
      // The service handles invalid tokens gracefully - always returns success
      await fastify.oauthTokenService.revokeToken(
        body.token,
        body.token_type_hint,
      );

      // RFC 7009 §2.1: "The authorization server responds with HTTP status
      // code 200 if the token has been revoked successfully or if the client
      // submitted an invalid token."
      return res.status(200).send({});
    },
  });
};
