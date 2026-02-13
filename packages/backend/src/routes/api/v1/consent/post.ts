import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
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
    url: '/consent',
    schema: {
      summary: 'Submit consent decision',
      description: 'Handles the user consent decision for OAuth authorization.',
      tags: [TAGS.CONSENT],
      body: z.object({
        client_id: f.clientId,
        redirect_uri: f.redirectUri,
        response_type: f.responseType,
        scope: f.scope.optional(),
        state: f.state.optional(),
        nonce: f.nonce.optional(),
        code_challenge: f.codeChallenge.optional(),
        code_challenge_method: f.codeChallengeMethod.optional(),
        decision: f.consentDecision,
      }),
      response: {
        200: r.RedirectUrlResponse,
        400: e.OAuthClientNotFound.Schema,
        401: e.Unauthorized.Schema,
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
      const userSession = await req.auth.verify();

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

      // Look up client to get primary key (client_id in request is the business key)
      const client = await fastify.oauthClientService.findByClientId(client_id);

      await fastify.userConsentService.grantConsent({
        userId: userSession.id,
        clientId: client.id, // Use primary key, not business key
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
