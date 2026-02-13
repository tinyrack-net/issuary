import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';
import type { AuthorizeParams } from '@/services/oauth-authorize.service.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '/authorize',
    schema: {
      summary: 'Authorize',
      description: 'OAuth2 Authorization Endpoint',
      tags: [TAGS.OPENID],
      querystring: z.object({
        response_type: f.responseType,
        redirect_uri: f.redirectUri,
        state: f.state.optional(),
        client_id: f.clientId,
        code_challenge: f.codeChallenge.optional(),
        code_challenge_method: f.codeChallengeMethod.optional().default('S256'),
        scope: f.scope.optional(),
        nonce: f.nonce.optional(),
        prompt: f.prompt.optional(),
        max_age: f.maxAge.optional(),
        display: f.display.optional(),
      }),
      response: {
        302: z.null(),
        400: r.OAuthError,
      },
    },
    handler: async (req, res) => {
      const { query } = req;

      // Helper function to redirect with error
      const redirectWithError = (
        error: string,
        errorDescription: string,
        redirectUri?: string,
      ) => {
        if (!redirectUri) {
          return res.status(400).send({
            error,
            error_description: errorDescription,
          });
        }

        const url = new URL(redirectUri);
        url.searchParams.set('error', error);
        url.searchParams.set('error_description', errorDescription);
        if (query.state) {
          url.searchParams.set('state', query.state);
        }

        return res.redirect(url.toString());
      };

      try {
        // Get user session (includes all authentication metadata)
        const userSession = req.session.get('user');

        // Call authorize service
        const authorizeParams: {
          query: AuthorizeParams;
          userSession?: {
            id: string;
            authenticated_at: number;
          };
        } = {
          query: query,
        };

        if (userSession) {
          authorizeParams.userSession = userSession;
        }

        const result =
          await fastify.oauthAuthorizeService.authorize(authorizeParams);

        // Redirect based on result
        return res.redirect(result.url);
      } catch (error) {
        // Handle ApiError with OAuth error codes

        // RFC 6749 §4.1.2.1: If client_id is invalid or redirect_uri validation fails,
        // do NOT redirect to the provided redirect_uri (security vulnerability)
        if (error instanceof e.OAuthClientNotFound.Error) {
          return redirectWithError(
            'unauthorized_client',
            error.message,
            undefined, // Don't redirect - client_id is invalid
          );
        }

        if (error instanceof e.OAuthClientDisabled.Error) {
          return redirectWithError(
            'unauthorized_client',
            error.message,
            undefined, // Don't redirect - client is not trusted
          );
        }

        if (error instanceof e.InvalidRedirectUri.Error) {
          // Don't redirect to invalid URI
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
        fastify.log.error(error);
        return redirectWithError(
          'server_error',
          'An unexpected error occurred',
          query.redirect_uri,
        );
      }
    },
  });
};
