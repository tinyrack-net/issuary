import z from 'zod/v4';
import type { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { signAccessToken, signIdToken, signRefreshToken } from '@/lib/jwt.js';
import { validatePKCE } from '@/lib/pkce.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Token',
      description:
        'OAuth2 Token Endpoint - Exchange authorization code for tokens',
      tags: ['OpenID'],
      body: z.object({
        grant_type: z.enum(['authorization_code', 'refresh_token']),
        code: z.string().min(1).max(1000).optional(),
        redirect_uri: z.string().min(1).max(1000).optional(),
        client_id: z.string().min(1).max(1000),
        client_secret: z.string().min(1).max(1000).optional(),
        code_verifier: z.string().min(43).max(128).optional(),
        refresh_token: z.string().optional(),
      }),
      response: {
        200: z.object({
          access_token: z.string(),
          token_type: z.literal('Bearer'),
          expires_in: z.number().int(),
          refresh_token: z.string().optional(),
          id_token: z.string().optional(),
          scope: z.string(),
        }),
        400: z.object({
          error: z.string(),
          error_description: z.string(),
        }),
        401: z.object({
          error: z.string(),
          error_description: z.string(),
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
        return res.status(401).send({
          error: 'invalid_client',
          error_description: 'Client is disabled',
        });
      }

      // 2. Validate client secret if provided
      if (body.client_secret) {
        const isValid = await fastify.oauthClientService.verifyClientSecret(
          body.client_id,
          body.client_secret,
        );
        if (!isValid) {
          return res.status(401).send({
            error: 'invalid_client',
            error_description: 'Invalid client credentials',
          });
        }
      }

      // 3. Handle grant type
      if (body.grant_type === 'authorization_code') {
        // Authorization Code Grant
        if (!body.code) {
          return res.status(400).send({
            error: 'invalid_request',
            error_description: 'Missing authorization code',
          });
        }

        if (!body.redirect_uri) {
          return res.status(400).send({
            error: 'invalid_request',
            error_description: 'Missing redirect_uri',
          });
        }

        // Verify and consume the authorization code
        let codeEntity: OAuthCodeEntity | null;
        try {
          codeEntity = await fastify.mikro.oauthCode.verifyAndConsumeCode(
            body.code,
            client.clientId,
          );
        } catch (error: unknown) {
          return res.status(400).send({
            error: 'invalid_grant',
            error_description:
              error instanceof Error
                ? error.message
                : 'Invalid or expired authorization code',
          });
        }

        if (!codeEntity) {
          return res.status(400).send({
            error: 'invalid_grant',
            error_description: 'Invalid or expired authorization code',
          });
        }

        // Validate redirect_uri matches
        if (codeEntity.redirectUri !== body.redirect_uri) {
          return res.status(400).send({
            error: 'invalid_grant',
            error_description: 'Redirect URI mismatch',
          });
        }

        // Validate PKCE if code_challenge was used
        if (codeEntity.codeChallenge) {
          if (!body.code_verifier) {
            return res.status(400).send({
              error: 'invalid_request',
              error_description: 'Missing code_verifier for PKCE',
            });
          }

          const isPKCEValid = await validatePKCE(
            body.code_verifier,
            codeEntity.codeChallenge,
            codeEntity.codeChallengeMethod,
          );

          if (!isPKCEValid) {
            return res.status(400).send({
              error: 'invalid_grant',
              error_description: 'Invalid PKCE code_verifier',
            });
          }
        }

        // Load user (supports both config and DB users)
        const userData = await fastify.userService.verifyUserById(
          codeEntity.userId,
        );

        // For token generation, we need a user object with email
        // Config users don't have a DB entity, so we create a simple object
        const user = {
          id: userData.id,
          email: userData.email,
          email_verified: userData.email_verified,
        };

        // Generate tokens
        const scope = codeEntity.scope.join(' ');
        const accessToken = await signAccessToken({
          sub: user.id,
          client_id: client.clientId,
          scope,
        });

        const refreshToken = await signRefreshToken({
          sub: user.id,
          client_id: client.clientId,
          scope,
        });

        // Check if OIDC (openid scope present)
        const isOIDC = codeEntity.scope.includes('openid');
        let idToken: string | undefined;

        if (isOIDC) {
          const idTokenPayload: {
            sub: string;
            aud: string;
            nonce?: string;
            email?: string;
            email_verified?: boolean;
            name?: string;
          } = {
            sub: user.id,
            aud: client.clientId,
          };

          if (codeEntity.nonce) {
            idTokenPayload.nonce = codeEntity.nonce;
          }

          // Add claims based on scope
          if (codeEntity.scope.includes('email')) {
            idTokenPayload.email = user.email;
            idTokenPayload.email_verified = user.email_verified;
          }

          if (codeEntity.scope.includes('profile')) {
            idTokenPayload.name = user.email; // Use email as name for now
          }

          idToken = await signIdToken(idTokenPayload);
        }

        return res.status(200).send({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: refreshToken,
          id_token: idToken,
          scope,
        });
      } else if (body.grant_type === 'refresh_token') {
        // Refresh Token Grant
        if (!body.refresh_token) {
          return res.status(400).send({
            error: 'invalid_request',
            error_description: 'Missing refresh_token',
          });
        }

        // Verify refresh token
        const { verifyRefreshToken } = await import('@/lib/jwt.js');
        let refreshPayload: Awaited<ReturnType<typeof verifyRefreshToken>>;

        try {
          refreshPayload = await verifyRefreshToken(body.refresh_token);
        } catch {
          return res.status(400).send({
            error: 'invalid_grant',
            error_description: 'Invalid or expired refresh token',
          });
        }

        // Validate client_id matches
        if (refreshPayload.client_id !== client.clientId) {
          return res.status(400).send({
            error: 'invalid_grant',
            error_description: 'Client ID mismatch',
          });
        }

        // Load user (supports both config and DB users)
        const userData = await fastify.userService.verifyUserById(
          refreshPayload.sub,
        );

        const user = {
          id: userData.id,
          email: userData.email,
          email_verified: userData.email_verified,
        };

        // Generate new tokens
        const accessToken = await signAccessToken({
          sub: user.id,
          client_id: client.clientId,
          scope: refreshPayload.scope,
        });

        const newRefreshToken = await signRefreshToken({
          sub: user.id,
          client_id: client.clientId,
          scope: refreshPayload.scope,
        });

        return res.status(200).send({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: newRefreshToken,
          scope: refreshPayload.scope,
        });
      }

      return res.status(400).send({
        error: 'unsupported_grant_type',
        error_description: `Grant type '${body.grant_type}' is not supported`,
      });
    },
  });
};
