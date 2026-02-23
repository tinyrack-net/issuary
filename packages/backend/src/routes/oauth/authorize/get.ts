import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import type { AuthorizeParams } from '@backend/services/oauth-authorize.service.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

export const authorizeGet = new Hono<AppEnv>().get(
  '/authorize',
  describeRoute({
    tags: [TAGS.OPENID],
    summary: 'Authorize',
    description: 'OAuth2 Authorization Endpoint',
    responses: {
      302: {
        description: 'Redirect',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(r.OAuthError),
          },
        },
        description: 'OAuth error',
      },
    },
  }),
  validator(
    'query',
    z.object({
      response_type: f.responseType,
      redirect_uri: f.redirectUri,
      state: f.state.optional(),
      client_id: f.clientId,
      code_challenge: f.codeChallenge.optional(),
      code_challenge_method: f.codeChallengeMethod.default('S256'),
      scope: f.scope.optional(),
      nonce: f.nonce.optional(),
      prompt: f.prompt.optional(),
      max_age: f.maxAge.optional(),
      display: f.display.optional(),
    }),
  ),
  verifyAuth({ optional: true }),
  async (c) => {
    const query = c.req.valid('query');
    const { oauthAuthorizeService } = c.var.services;

    // Helper function to redirect with error
    const redirectWithError = (
      error: string,
      errorDescription: string,
      redirectUri?: string,
    ) => {
      if (!redirectUri) {
        return c.json(
          {
            error,
            error_description: errorDescription,
          },
          400,
        );
      }

      const url = new URL(redirectUri);
      url.searchParams.set('error', error);
      url.searchParams.set('error_description', errorDescription);
      if (query.state) {
        url.searchParams.set('state', query.state);
      }

      return c.redirect(url.toString());
    };

    try {
      const verifiedUser = c.var.verifiedUser;

      // Call authorize service
      const authorizeParams: {
        query: AuthorizeParams;
        userSession?: {
          sub: string;
          authenticated_at: number;
        };
      } = {
        query: query,
      };

      if (verifiedUser) {
        authorizeParams.userSession = {
          sub: verifiedUser.user.sub,
          authenticated_at: verifiedUser.authenticatedAt,
        };
      }

      const result = await oauthAuthorizeService.authorize(authorizeParams);

      // Redirect based on result
      return c.redirect(result.url);
    } catch (error) {
      // RFC 6749 §4.1.2.1: If client_id is invalid or redirect_uri validation fails,
      // do NOT redirect to the provided redirect_uri
      if (error instanceof e.OAuthClientNotFound.Error) {
        return redirectWithError(
          'unauthorized_client',
          error.message,
          undefined,
        );
      }

      if (error instanceof e.OAuthClientDisabled.Error) {
        return redirectWithError(
          'unauthorized_client',
          error.message,
          undefined,
        );
      }

      if (error instanceof e.InvalidRedirectUri.Error) {
        return redirectWithError('invalid_request', error.message, undefined);
      }

      // Only redirect errors that occur AFTER successful client + redirect_uri validation
      if (error instanceof e.UnsupportedResponseType.Error) {
        return redirectWithError(
          'unsupported_response_type',
          error.message,
          query.redirect_uri,
        );
      }

      if (error instanceof e.InvalidScope.Error) {
        return redirectWithError(
          'invalid_scope',
          error.message,
          query.redirect_uri,
        );
      }

      if (error instanceof e.InvalidCodeChallengeMethod.Error) {
        return redirectWithError(
          'invalid_request',
          error.message,
          query.redirect_uri,
        );
      }

      // Log unexpected errors
      c.var.logger.error({ err: error }, 'Unexpected authorize error');
      return redirectWithError(
        'server_error',
        'An unexpected error occurred',
        query.redirect_uri,
      );
    }
  },
);
