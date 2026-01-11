import z from 'zod/v4';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/oauth/consent
 *
 * Handles user consent decision (allow/deny).
 * If allowed, stores consent and returns the authorize URL.
 * If denied, returns the error redirect URL.
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Submit consent decision',
      description: 'Handles the user consent decision for OAuth authorization.',
      tags: ['Consent'],
      body: z.object({
        client_id: z
          .string()
          .min(1)
          .max(1000)
          .describe('OAuth client ID requesting authorization'),
        redirect_uri: z
          .string()
          .min(1)
          .max(1000)
          .describe('URI to redirect after authorization'),
        response_type: z
          .string()
          .min(1)
          .max(100)
          .describe('OAuth2 response type'),
        scope: z
          .string()
          .max(1000)
          .optional()
          .describe('Space-delimited list of requested scopes'),
        state: z
          .string()
          .max(1000)
          .optional()
          .describe('State parameter to return to the client'),
        nonce: z.string().max(1000).optional().describe('OIDC nonce parameter'),
        code_challenge: z
          .string()
          .max(1000)
          .optional()
          .describe('PKCE code challenge'),
        code_challenge_method: z
          .enum(['S256', 'plain'])
          .optional()
          .describe('PKCE code challenge method'),
        decision: z
          .enum(['allow', 'deny'])
          .describe('User consent decision: "allow" or "deny"'),
      }),
      response: {
        200: z.object({
          redirect_url: z.string(),
        }),
        401: z.object({
          code: z.string(),
          message: z.string(),
        }),
        400: z.object({
          code: z.string(),
          message: z.string(),
        }),
      },
    },
    handler: async (req, res) => {
      const {
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        nonce,
        code_challenge,
        code_challenge_method,
        decision,
      } = req.body;

      // Check if user is logged in
      const userSession = req.session.get('user');
      if (!userSession?.id) {
        return res.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'User must be logged in to submit consent.',
        });
      }

      // If user denied consent, redirect back with error
      if (decision === 'deny') {
        const errorUrl = new URL(redirect_uri);
        errorUrl.searchParams.set('error', 'access_denied');
        errorUrl.searchParams.set(
          'error_description',
          'The resource owner or authorization server denied the request.',
        );
        if (state) {
          errorUrl.searchParams.set('state', state);
        }

        return res.status(200).send({
          redirect_url: errorUrl.toString(),
        });
      }

      // User allowed consent - store it
      const requestedScopes = scope ? scope.split(' ') : [];

      await fastify.userConsentService.grantConsent({
        userId: userSession.id,
        clientId: client_id,
        scopes: requestedScopes,
      });

      // Build authorize URL to continue the flow
      const authorizeUrl = new URL(
        '/application/oauth/authorize',
        `${req.protocol}://${req.host}`,
      );
      authorizeUrl.searchParams.set('client_id', client_id);
      authorizeUrl.searchParams.set('redirect_uri', redirect_uri);
      authorizeUrl.searchParams.set('response_type', response_type);

      if (scope) {
        authorizeUrl.searchParams.set('scope', scope);
      }
      if (state) {
        authorizeUrl.searchParams.set('state', state);
      }
      if (nonce) {
        authorizeUrl.searchParams.set('nonce', nonce);
      }
      if (code_challenge) {
        authorizeUrl.searchParams.set('code_challenge', code_challenge);
      }
      if (code_challenge_method) {
        authorizeUrl.searchParams.set(
          'code_challenge_method',
          code_challenge_method,
        );
      }

      return res.status(200).send({
        redirect_url: authorizeUrl.toString(),
      });
    },
  });
};
