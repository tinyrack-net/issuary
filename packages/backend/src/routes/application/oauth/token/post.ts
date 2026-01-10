import z from 'zod/v4';
import { e } from '@/schemas/error.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Token',
      description:
        'OAuth2 Token Endpoint - Exchange authorization code or refresh token for access tokens (RFC 6749)',
      tags: ['OpenID'],
      body: z.object({
        grant_type: z
          .enum(['authorization_code', 'refresh_token'])
          .describe(
            'OAuth 2.0 grant type. "authorization_code" for initial token request after user authorization, "refresh_token" to refresh expired access tokens without re-authentication.',
          ),
        code: z
          .string()
          .min(1)
          .max(1000)
          .optional()
          .describe(
            'Authorization code received from /authorize endpoint. Single-use, expires after 10 minutes. Required for authorization_code grant.',
          ),
        redirect_uri: z
          .string()
          .min(1)
          .max(1000)
          .optional()
          .describe(
            'Redirect URI used in the authorization request. Must exactly match the original value for security validation. Required for authorization_code grant.',
          ),
        client_id: z
          .string()
          .min(1)
          .max(1000)
          .describe(
            'Unique identifier of the OAuth client application. Must match the client that initiated the authorization flow.',
          ),
        client_secret: z
          .string()
          .min(1)
          .max(1000)
          .optional()
          .describe(
            'Client secret for confidential clients (server-side apps). Required for confidential clients, optional for public clients using PKCE. Never expose in browser/mobile apps.',
          ),
        code_verifier: z
          .string()
          .min(43)
          .max(128)
          .optional()
          .describe(
            'PKCE code verifier (random string, 43-128 chars). Required if code_challenge was used in authorization request. Proves the token request comes from the same client that initiated authorization (RFC 7636).',
          ),
        refresh_token: z
          .string()
          .optional()
          .describe(
            'Refresh token received from a previous token response. Used to obtain new access tokens without user interaction. Required for refresh_token grant.',
          ),
      }),
      response: {
        200: z.object({
          access_token: z
            .string()
            .describe(
              'OAuth 2.0 access token (JWT format). Include in Authorization header as "Bearer <token>" for API requests. Expires after 1 hour.',
            ),
          token_type: z
            .literal('Bearer')
            .describe(
              'Token type identifier (always "Bearer" for OAuth 2.0). Indicates how the access token should be used in requests.',
            ),
          expires_in: z
            .number()
            .int()
            .describe(
              'Access token lifetime in seconds (3600 = 1 hour). Use refresh token to get new access token after expiration.',
            ),
          refresh_token: z
            .string()
            .optional()
            .describe(
              'Refresh token (JWT format) for obtaining new access tokens. Store securely. Does not expire but can be revoked.',
            ),
          id_token: z
            .string()
            .optional()
            .describe(
              'OpenID Connect ID Token (JWT format). Contains authenticated user identity claims (sub, email, etc.). Only present if "openid" scope was requested.',
            ),
          scope: z
            .string()
            .describe(
              'Space-separated list of granted scopes (e.g., "openid email profile"). May differ from requested scopes if some were denied.',
            ),
        }),
        400: z.object({
          code: z.string(),
          message: z.string(),
        }),
        401: z.object({
          code: z.string(),
          message: z.string(),
        }),
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
