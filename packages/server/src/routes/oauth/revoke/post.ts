import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.ts';
import { TAGS } from '../../../lib/swagger-tags.ts';
import { e } from '../../../schemas/error.ts';
import { f } from '../../../schemas/field.ts';
import {
  parseBasicClientCredentials,
  setBasicClientAuthChallengeIfInvalidClientCredentials,
  throwInvalidClientCredentialsWithBasicChallenge,
} from '../client-auth.js';
import { setOAuthClientCorsHeaders } from '../cors.js';

const RevokeRequestBody = z
  .object({
    token: f.token,
    token_type_hint: f.tokenTypeHint.optional(),
    client_id: f.clientId.optional(),
    client_secret: f.clientSecret.optional(),
  })
  .describe('OAuth2 token revocation request payload');

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
  validator('form', RevokeRequestBody),
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

    const client = await oauthClientService.findByClientId(clientId);
    setOAuthClientCorsHeaders(c, client);

    if (!client.enabled) {
      throw new e.OAuthClientDisabled.Error();
    }

    const clientSecret = basicCredentials?.clientSecret ?? body.client_secret;

    try {
      await oauthClientService.validateClientSecretIfRequired(
        clientId,
        clientSecret,
      );
    } catch (err) {
      if (authorizationHeader) {
        setBasicClientAuthChallengeIfInvalidClientCredentials(c, err);
      }
      throw err;
    }

    await oauthTokenService.revokeToken(
      body.token,
      body.token_type_hint,
      clientId,
    );

    return c.json({}, 200);
  },
);
