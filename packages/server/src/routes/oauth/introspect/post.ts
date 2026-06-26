import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.ts';
import { TAGS } from '../../../lib/swagger-tags.ts';
import { e } from '../../../schemas/error.ts';
import { f } from '../../../schemas/field.ts';
import { r } from '../../../schemas/response.ts';
import {
  parseBasicClientCredentials,
  setBasicClientAuthChallengeIfInvalidClientCredentials,
  throwInvalidClientCredentialsWithBasicChallenge,
} from '../client-auth.js';

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
    const authorizationHeader = c.req.header('authorization');
    const basicCredentials = parseBasicClientCredentials(authorizationHeader);

    if (basicCredentials === null) {
      throwInvalidClientCredentialsWithBasicChallenge(c);
    }

    if (basicCredentials && body.client_secret) {
      throwInvalidClientCredentialsWithBasicChallenge(c);
    }

    if (basicCredentials && body.client_id) {
      if (basicCredentials.clientId !== body.client_id) {
        throwInvalidClientCredentialsWithBasicChallenge(c);
      }
    }

    const clientId = basicCredentials?.clientId ?? body.client_id;
    if (!clientId) {
      throw new e.InvalidClientCredentials.Error();
    }

    let client: Awaited<ReturnType<typeof oauthClientService.findByClientId>>;
    try {
      client = await oauthClientService.findByClientId(clientId);
    } catch (err) {
      if (authorizationHeader) {
        throwInvalidClientCredentialsWithBasicChallenge(c);
      }
      throw err;
    }

    if (!client.enabled) {
      throw new e.OAuthClientDisabled.Error();
    }

    const clientSecret = basicCredentials?.clientSecret ?? body.client_secret;

    try {
      if (!clientSecret) {
        throw new e.InvalidClientCredentials.Error();
      }

      const isValidClientSecret = await oauthClientService.verifyClientSecret(
        clientId,
        clientSecret,
      );

      if (!isValidClientSecret) {
        throw new e.InvalidClientCredentials.Error();
      }
    } catch (err) {
      if (authorizationHeader) {
        setBasicClientAuthChallengeIfInvalidClientCredentials(c, err);
      }
      throw err;
    }

    const result = await oauthTokenService.introspectToken(
      body.token,
      body.token_type_hint,
      clientId,
    );

    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');
    return c.json(result, 200);
  },
);
