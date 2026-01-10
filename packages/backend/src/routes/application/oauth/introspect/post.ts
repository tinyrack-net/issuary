import z from 'zod/v4';
import { e } from '@/schemas/error.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Token Introspection',
      description:
        'OAuth2 Token Introspection Endpoint - Returns metadata about tokens (RFC 7662)',
      tags: ['OpenID'],
      body: z.object({
        token: z
          .string()
          .min(1)
          .describe(
            'The token to introspect (access token or refresh token). Required.',
          ),
        token_type_hint: z
          .enum(['access_token', 'refresh_token'])
          .optional()
          .describe(
            'Optional hint about the type of token being introspected. Helps optimize validation.',
          ),
        client_id: z
          .string()
          .min(1)
          .max(1000)
          .optional()
          .describe(
            'OAuth client identifier. Optional but recommended for client authentication.',
          ),
        client_secret: z
          .string()
          .min(1)
          .max(1000)
          .optional()
          .describe(
            'Client secret for confidential clients. Required if client_id is provided for confidential clients.',
          ),
      }),
      response: {
        200: z.object({
          active: z
            .boolean()
            .describe(
              'Whether the token is currently active. False if expired, invalid, or revoked.',
            ),
          scope: z
            .string()
            .optional()
            .describe(
              'Space-separated list of scopes associated with the token. Only present if active=true.',
            ),
          client_id: z
            .string()
            .optional()
            .describe(
              'Client identifier for which the token was issued. Only present if active=true.',
            ),
          token_type: z
            .literal('Bearer')
            .optional()
            .describe(
              'Type of the token (always "Bearer"). Only present if active=true.',
            ),
          exp: z
            .number()
            .int()
            .optional()
            .describe(
              'Expiration timestamp (seconds since epoch). Only present if active=true.',
            ),
          iat: z
            .number()
            .int()
            .optional()
            .describe(
              'Issued-at timestamp (seconds since epoch). Only present if active=true.',
            ),
          sub: z
            .string()
            .optional()
            .describe(
              'Subject identifier (user ID). Only present if active=true.',
            ),
          iss: z
            .string()
            .optional()
            .describe(
              'Issuer identifier (this server). Only present if active=true.',
            ),
        }),
        400: z.object({
          code: z.string(),
          message: z.string(),
        }),
        401: z.object({
          code: z.string(),
          message: z.string(),
        }),
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
