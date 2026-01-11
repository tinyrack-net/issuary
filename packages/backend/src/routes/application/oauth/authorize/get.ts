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
    url: '',
    schema: {
      summary: 'Authorize',
      description: 'OAuth2 Authorization Endpoint',
      tags: [TAGS.OPENID],
      querystring: z.object({
        response_type: f.responseType.describe(
          'OAuth2 response type (e.g., "code", "token"). Must be registered for this client.',
        ),
        redirect_uri: f.redirectUri.describe(
          'URI to redirect the user after authorization. Must exactly match one of the pre-registered redirect URIs for the client.',
        ),
        state: f.state
          .optional()
          .describe(
            'Opaque value used to maintain state between the request and callback. Recommended for CSRF protection. Will be returned unchanged in the redirect.',
          ),
        client_id: f.clientId.describe(
          'Unique identifier of the OAuth client application. Used to validate the client and verify allowed configurations.',
        ),
        code_challenge: f.codeChallenge
          .optional()
          .describe(
            'PKCE code challenge derived from a code verifier. Used to prevent authorization code interception attacks. Recommended for public clients (SPAs, mobile apps).',
          ),
        code_challenge_method: f.codeChallengeMethod
          .optional()
          .default('S256')
          .describe(
            'Method used to derive the code challenge from the verifier. "S256" (SHA-256 hash, recommended) or "plain" (no transformation). Defaults to "S256".',
          ),
        scope: f.scope
          .optional()
          .describe(
            'Space-delimited list of requested permission scopes (e.g., "openid profile email"). Each scope must be allowed for this client. Include "openid" for OIDC requests.',
          ),
        nonce: f.nonce
          .optional()
          .describe(
            'Random value used to mitigate replay attacks in OIDC flows. Will be included in the ID token for client verification.',
          ),
        prompt: z
          .enum(['none', 'login', 'consent', 'select_account'])
          .optional()
          .describe(
            'Controls authorization UI behavior. "none" (no UI, fail if interaction needed), "login" (force re-authentication), "consent" (show consent screen), "select_account" (account chooser).',
          ),
        max_age: z.coerce
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Maximum authentication age in seconds. If the user's last authentication is older than this value, re-authentication will be required.",
          ),
        display: z
          .enum(['page', 'popup', 'touch', 'wap'])
          .optional()
          .describe(
            'How the authorization server should display the authentication UI. "page" (full page), "popup" (popup window), "touch" (touch-optimized), "wap" (WAP device).',
          ),
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
        // Get user session
        const userSession = req.session.get('user');

        // Call authorize service
        const authorizeParams: {
          query: AuthorizeParams;
          userSession?: { id: string };
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
