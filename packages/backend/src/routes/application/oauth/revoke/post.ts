import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { createRoute, z } from '@hono/zod-openapi';

/**
 * OAuth 2.0 Token Revocation Endpoint (RFC 7009)
 */
const route = createRoute({
  method: 'post',
  path: '/revoke',
  tags: [TAGS.OPENID],
  summary: 'Token Revocation',
  description:
    'OAuth 2.0 Token Revocation Endpoint - Revokes access or refresh tokens (RFC 7009)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: f.token,
            token_type_hint: f.tokenTypeHint.optional(),
            client_id: f.clientId.optional(),
            client_secret: f.clientSecret.optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({})
            .describe(
              'Token revoked successfully or token was already invalid.',
            ),
        },
      },
      description: 'Token revoked',
    },
    400: {
      content: {
        'application/json': {
          schema: e.OAuthClientNotFound.Schema,
        },
      },
      description: 'OAuth client not found or disabled',
    },
    401: {
      content: {
        'application/json': {
          schema: e.InvalidClientCredentials.Schema,
        },
      },
      description: 'Invalid client credentials',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const body = c.req.valid('json');
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
});
