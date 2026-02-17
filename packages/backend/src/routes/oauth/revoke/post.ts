import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

/**
 * OAuth 2.0 Token Revocation Endpoint (RFC 7009)
 */
export const revokePost = new Hono<AppEnv>().post(
  '/revoke',
  describeRoute({
    tags: [TAGS.OPENID],
    summary: 'Token Revocation',
    description:
      'OAuth 2.0 Token Revocation Endpoint - Revokes access or refresh tokens (RFC 7009)',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(
              z
                .object({})
                .describe(
                  'Token revoked successfully or token was already invalid.',
                ),
            ),
          },
        },
        description: 'Token revoked',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.OAuthClientNotFound.Schema),
          },
        },
        description: 'OAuth client not found or disabled',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.InvalidClientCredentials.Schema),
          },
        },
        description: 'Invalid client credentials',
      },
    },
  }),
  validator(
    'form',
    z.object({
      token: f.token,
      token_type_hint: f.tokenTypeHint.optional(),
      client_id: f.clientId.optional(),
      client_secret: f.clientSecret.optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid('form');
    const { oauthClientService, oauthTokenService } = c.get('services');

    // 1. Validate client credentials if provided
    if (body.client_id) {
      const client = await oauthClientService.findByClientId(body.client_id);

      if (!client.enabled) {
        throw new e.OAuthClientDisabled.Error();
      }

      if (body.client_secret) {
        const isValid = await oauthClientService.verifyClientSecret(
          body.client_id,
          body.client_secret,
        );
        if (!isValid) {
          throw new e.InvalidClientCredentials.Error();
        }
      }
    }

    // 3. Revoke the token
    await oauthTokenService.revokeToken(body.token, body.token_type_hint);

    return c.json({}, 200);
  },
);
