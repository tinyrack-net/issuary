import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '#backend/lib/app-env.js';
import { TAGS } from '#backend/lib/swagger-tags.js';

export const jwksGet = new Hono<AppEnv>().get(
  '/.well-known/jwks',
  describeRoute({
    tags: [TAGS.OPENID],
    summary: 'JWKS',
    description:
      'JSON Web Key Set (JWKS) endpoint - Returns RSA public keys used for verifying tokens (RFC 7517). Supports automatic key rotation with multiple active keys.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                keys: z
                  .array(
                    z.object({
                      kty: z.string().describe('Key Type'),
                      use: z.string().describe('Public Key Use'),
                      kid: z.string().describe('Key ID'),
                      alg: z.string().describe('Algorithm'),
                      n: z.string().optional().describe('RSA modulus'),
                      e: z.string().optional().describe('RSA exponent'),
                      x: z.string().optional().describe('EC x coordinate'),
                      y: z.string().optional().describe('EC y coordinate'),
                      crv: z.string().optional().describe('EC curve name'),
                    }),
                  )
                  .describe(
                    'Array of JWK objects representing public keys for token verification',
                  ),
              }),
            ),
          },
        },
        description: 'JWKS response',
      },
    },
  }),
  async (c) => {
    const { jwtService } = c.var.services;

    // Get JWKS from JwtService
    const jwks = await jwtService.getJWKS();

    // Set cache headers
    c.header('Cache-Control', 'public, max-age=3600');

    return c.json(jwks, 200);
  },
);
