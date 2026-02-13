import { createRoute } from '@hono/zod-openapi';
import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

const route = createRoute({
  method: 'post',
  path: '/introspect',
  tags: [TAGS.OPENID],
  summary: 'Token Introspection',
  description:
    'OAuth2 Token Introspection Endpoint - Returns metadata about tokens (RFC 7662)',
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
          schema: r.IntrospectionResponse,
        },
      },
      description: 'Success',
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

export default (app: AppType) => {
  app.openapi(route, async (c) => {
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

    // 3. Introspect the token
    const result = await oauthTokenService.introspectToken(
      body.token,
      body.token_type_hint,
    );

    return c.json(result, 200);
  });
};
