import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

const IntrospectionRequestBody = z
  .object({
    token: f.token,
    token_type_hint: f.tokenTypeHint.optional(),
    client_id: f.clientId.optional(),
    client_secret: f.clientSecret.optional(),
  })
  .describe('OAuth2 token introspection request payload');

export const introspectPost = new Hono<AppEnv>().post(
  '/introspect',
  describeRoute({
    tags: [TAGS.OPENID],
    summary: 'Token Introspection',
    description:
      'OAuth2 Token Introspection Endpoint - Returns metadata about tokens (RFC 7662)',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.IntrospectionResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(
              z.union([
                e.OAuthClientNotFound.Schema,
                e.OAuthClientDisabled.Schema,
              ]),
            ),
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
  validator('form', IntrospectionRequestBody),
  async (c) => {
    const body = c.req.valid('form');
    const { oauthClientService, oauthTokenService } = c.var.services;

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
  },
);
