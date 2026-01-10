import z from 'zod/v4';
import {
  ProviderNotFoundError,
  validateProvider,
} from '@/handlers/validate-provider.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * JWK (JSON Web Key) schema according to RFC 7517
 *
 * Note: Currently using HS256 symmetric key algorithm,
 * so JWKS returns an empty array. When migrating to RS256/ES256,
 * this schema will contain actual public key parameters.
 */
const JWKSchema = z.object({
  /** Key Type (e.g., "RSA", "EC", "oct") */
  kty: z.string().describe('Key Type'),
  /** Public Key Use ("sig" for signature) */
  use: z.literal('sig').describe('Public Key Use'),
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
});

/**
 * JWKS (JSON Web Key Set) response schema according to RFC 7517 §5
 */
const JWKSResponseSchema = z.object({
  keys: z
    .array(JWKSchema)
    .describe(
      'Array of JWK objects representing public keys for token verification',
    ),
});

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'JWKS',
      description:
        'JSON Web Key Set (JWKS) endpoint - Returns public keys used for verifying tokens (RFC 7517). Currently using HS256 symmetric key, so keys array is empty.',
      tags: ['OpenID'],
      params: z.object({
        provider_id: z
          .string()
          .describe('OAuth provider/client ID to retrieve JWKS for'),
      }),
      response: {
        200: JWKSResponseSchema,
        400: z.object({
          code: z.string(),
          message: z.string(),
        }),
      },
    },
    handler: async (req, res) => {
      try {
        // Validate that the provider exists
        await validateProvider(req.params.provider_id);

        // Return empty JWKS since we use HS256 symmetric key
        // HS256 uses a shared secret, not public/private key pairs,
        // so there are no public keys to expose.
        //
        // When migrating to RS256/ES256, this endpoint will return
        // the actual public keys for token verification.
        return res.status(200).send({
          keys: [],
        });
      } catch (error) {
        if (error instanceof ProviderNotFoundError) {
          return res.status(400).send({
            code: 'PROVIDER_NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    },
  });
};
