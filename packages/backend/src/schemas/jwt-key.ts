import z from 'zod/v4';

/**
 * Key pair with PEM-encoded keys
 * Used for JWT signing key generation
 */
const KeyPair = z
  .object({
    /** Key ID for identifying the key in JWKS */
    kid: z.string(),
    /** PEM-encoded private key (PKCS#8 format) */
    privateKey: z.string(),
    /** PEM-encoded public key (SPKI format) */
    publicKey: z.string(),
    /** Algorithm (e.g., "RS256") */
    algorithm: z.string(),
  })
  .describe('RSA key pair with PEM-encoded keys');

/**
 * Public JWK for JWKS endpoint (RFC 7517)
 * All required fields are guaranteed to be present.
 * @see https://datatracker.ietf.org/doc/html/rfc7517
 */
const PublicJWK = z
  .object({
    /** Key Type (e.g., "RSA") */
    kty: z.string(),
    /** Public Key Use ("sig" for signature) */
    use: z.string(),
    /** Key ID */
    kid: z.string(),
    /** Algorithm (e.g., "RS256") */
    alg: z.string(),
    /** RSA modulus (base64url encoded) */
    n: z.string().optional(),
    /** RSA exponent (base64url encoded) */
    e: z.string().optional(),
    /** EC x coordinate (base64url encoded) */
    x: z.string().optional(),
    /** EC y coordinate (base64url encoded) */
    y: z.string().optional(),
    /** EC curve name */
    crv: z.string().optional(),
  })
  .describe('Public JWK for JWKS endpoint (RFC 7517)');

/**
 * JWT Key related schemas namespace
 * Usage: import { jwtKeySchema } from '@/schemas/jwt-key.js'
 * Type inference: type KeyPair = z.infer<typeof jwtKeySchema.KeyPair>
 */
export const jwtKeySchema = {
  KeyPair,
  PublicJWK,
};
