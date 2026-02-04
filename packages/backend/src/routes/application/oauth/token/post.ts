import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Token',
      description:
        'OAuth2 Token Endpoint - Exchange authorization code or refresh token for access tokens (RFC 6749)',
      tags: [TAGS.OPENID],
      body: z.object({
        grant_type: f.grantType,
        code: f.authorizationCode.optional(),
        redirect_uri: f.redirectUri.optional(),
        client_id: f.clientId,
        client_secret: f.clientSecret.optional(),
        code_verifier: f.codeVerifier.optional(),
        refresh_token: f.token.optional(),
      }),
      response: {
        200: r.TokenResponse,
        400: z.union([
          e.MissingAuthorizationCode.Schema,
          e.MissingRedirectUri.Schema,
          e.MissingRefreshToken.Schema,
          e.InvalidAuthorizationCode.Schema,
          e.RedirectUriMismatch.Schema,
          e.InvalidPKCEVerifier.Schema,
          e.InvalidRefreshToken.Schema,
          e.ClientIdMismatch.Schema,
          e.OAuthClientDisabled.Schema,
          e.UnsupportedGrantType.Schema,
        ]),
        401: e.InvalidClientCredentials.Schema,
      },
    },
    handler: async (req, res) => {
      const { body } = req;

      // 1. Validate client (supports config + DB clients)
      const client = await fastify.oauthClientService.findByClientId(
        body.client_id,
      );

      if (!client.enabled) {
        throw new e.OAuthClientDisabled.Error();
      }

      // 2. Validate client secret if provided
      // Confidential clients must authenticate (RFC 6749 §3.2.1)
      if (body.client_secret) {
        const isValid = await fastify.oauthClientService.verifyClientSecret(
          body.client_id,
          body.client_secret,
        );
        if (!isValid) {
          throw new e.InvalidClientCredentials.Error();
        }
      }

      // 3. Handle grant type
      if (body.grant_type === 'authorization_code') {
        // Authorization Code Grant (RFC 6749 §4.1.3)
        if (!body.code) {
          throw new e.MissingAuthorizationCode.Error();
        }
        if (!body.redirect_uri) {
          throw new e.MissingRedirectUri.Error();
        }

        // Exchange authorization code for tokens
        const tokens =
          await fastify.oauthTokenService.exchangeAuthorizationCode({
            code: body.code,
            redirectUri: body.redirect_uri,
            clientId: body.client_id,
            codeVerifier: body.code_verifier ?? undefined,
          });

        return res.status(200).send(tokens);
      }

      if (body.grant_type === 'refresh_token') {
        // Refresh Token Grant (RFC 6749 §6)
        if (!body.refresh_token) {
          throw new e.MissingRefreshToken.Error();
        }

        // Refresh access token
        const tokens = await fastify.oauthTokenService.refreshAccessToken({
          refreshToken: body.refresh_token,
          clientId: body.client_id,
        });

        return res.status(200).send(tokens);
      }

      // Unsupported grant type
      throw new e.UnsupportedGrantType.Error();
    },
  });
};
