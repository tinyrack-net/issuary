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

const TokenRequestBody = z
  .object({
    grant_type: f.grantType,
    code: f.authorizationCode.optional(),
    redirect_uri: f.redirectUri.optional(),
    client_id: f.clientId.optional(),
    client_secret: f.clientSecret.optional(),
    code_verifier: f.codeVerifier.optional(),
    refresh_token: f.token.optional(),
  })
  .describe('OAuth2 token request payload');

export const tokenPost = new Hono<AppEnv>().post(
  '/token',
  describeRoute({
    tags: [TAGS.OPENID],
    summary: 'Token',
    description:
      'OAuth2 Token Endpoint - Exchange authorization code or refresh token for access tokens (RFC 6749)',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.TokenResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(
              z.union([
                e.OAuthClientDisabled.Schema,
                e.MissingAuthorizationCode.Schema,
                e.MissingRedirectUri.Schema,
                e.MissingRefreshToken.Schema,
                e.UnsupportedGrantType.Schema,
              ]),
            ),
          },
        },
        description:
          'Bad request, unsupported grant type, missing parameters, or disabled client',
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
  validator('form', TokenRequestBody),
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

    // 1. Validate client
    const client = await oauthClientService.findByClientId(clientId);

    if (!client.enabled) {
      throw new e.OAuthClientDisabled.Error();
    }

    // 2. Confidential clients must authenticate; public clients must not.
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

    // 3. Handle grant type
    if (body.grant_type === 'authorization_code') {
      if (!body.code) {
        throw new e.MissingAuthorizationCode.Error();
      }
      if (!body.redirect_uri) {
        throw new e.MissingRedirectUri.Error();
      }

      const tokens = await oauthTokenService.exchangeAuthorizationCode({
        code: body.code,
        redirectUri: body.redirect_uri,
        clientId,
        codeVerifier: body.code_verifier ?? undefined,
      });

      return c.json(tokens, 200);
    }

    if (body.grant_type === 'refresh_token') {
      if (!body.refresh_token) {
        throw new e.MissingRefreshToken.Error();
      }

      const tokens = await oauthTokenService.refreshAccessToken({
        refreshToken: body.refresh_token,
        clientId,
      });

      return c.json(tokens, 200);
    }

    throw new e.UnsupportedGrantType.Error();
  },
);
