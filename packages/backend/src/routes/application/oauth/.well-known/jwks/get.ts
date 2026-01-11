import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'JWKS',
      description:
        'JSON Web Key Set (JWKS) endpoint - Returns RSA public keys used for verifying tokens (RFC 7517). Supports automatic key rotation with multiple active keys.',
      tags: [TAGS.OPENID],
      response: {
        /**
         * JWK (JSON Web Key) schema according to RFC 7517
         *
         * Supports RSA keys (RS256) with automatic key rotation.
         */
        200: z.object({
          keys: z
            .array(
              z.object({
                /** Key Type (e.g., "RSA", "EC", "oct") */
                kty: z.string().describe('Key Type'),
                /** Public Key Use ("sig" for signature) */
                use: z.string().describe('Public Key Use'),
                /** Key ID */
                kid: z.string().describe('Key ID'),
                /** Algorithm (e.g., "RS256", "ES256") */
                alg: z.string().describe('Algorithm'),
                // RSA key parameters
                /** RSA modulus (base64url encoded) */
                n: z.string().optional().describe('RSA modulus'),
                /** RSA exponent (base64url encoded) */
                e: z.string().optional().describe('RSA exponent'),
                // EC key parameters
                /** EC x coordinate (base64url encoded) */
                x: z.string().optional().describe('EC x coordinate'),
                /** EC y coordinate (base64url encoded) */
                y: z.string().optional().describe('EC y coordinate'),
                /** EC curve name */
                crv: z.string().optional().describe('EC curve name'),
              }),
            )
            .describe(
              'Array of JWK objects representing public keys for token verification',
            ),
        }),
      },
    },
    handler: async (_req, res) => {
      // Get JWKS from JwtKeyService
      // Returns all active and previous keys for token verification
      const jwks = await fastify.jwtKeyService.getJWKS();

      // Set cache headers for client optimization
      // Keys rotate infrequently, so caching is beneficial
      res.header('Cache-Control', 'public, max-age=3600'); // 1 hour

      return res.status(200).send(jwks);
    },
  });
};
