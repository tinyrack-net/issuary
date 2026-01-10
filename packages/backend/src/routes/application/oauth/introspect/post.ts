import { verify } from 'argon2';
import z from 'zod/v4';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { decodeToken, verifyAccessToken } from '@/lib/jwt.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Token Introspection',
      description: 'RFC 7662 - OAuth2 Token Introspection Endpoint',
      tags: ['OpenID'],
      body: z.object({
        token: z.string().min(1),
        token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
        client_id: z.string().min(1).max(1000).optional(),
        client_secret: z.string().min(1).max(1000).optional(),
      }),
      response: {
        200: z.object({
          active: z.boolean(),
          scope: z.string().optional(),
          client_id: z.string().optional(),
          username: z.string().optional(),
          token_type: z.string().optional(),
          exp: z.number().int().optional(),
          iat: z.number().int().optional(),
          sub: z.string().optional(),
          iss: z.string().optional(),
        }),
        401: z.object({
          error: z.string(),
          error_description: z.string(),
        }),
      },
    },
    handler: async (req, res) => {
      const { body } = req;
      const em = fastify.mikro.orm.em.fork();

      // Optional: Validate client credentials if provided
      if (body.client_id) {
        const client = await em.findOne(OAuthClientEntity, {
          clientId: body.client_id,
        });

        if (!client) {
          return res.status(401).send({
            error: 'invalid_client',
            error_description: 'Client not found',
          });
        }

        if (body.client_secret) {
          const isValid = await verify(
            client.clientSecretHash,
            body.client_secret,
          );
          if (!isValid) {
            return res.status(401).send({
              error: 'invalid_client',
              error_description: 'Invalid client credentials',
            });
          }
        }
      }

      try {
        // Try to verify the token
        const payload = await verifyAccessToken(body.token);

        // Token is valid
        return res.status(200).send({
          active: true,
          scope: payload.scope,
          client_id: payload.client_id,
          token_type: 'Bearer',
          exp: payload.exp,
          iat: payload.iat,
          sub: payload.sub,
          iss: payload.iss,
        });
      } catch {
        // Token is invalid or expired - try to decode without verification
        const decoded = decodeToken(body.token);

        if (decoded) {
          // Token was valid JWT but expired or invalid signature
          return res.status(200).send({
            active: false,
          });
        }

        // Token is not a valid JWT at all
        return res.status(200).send({
          active: false,
        });
      }
    },
  });
};
