import { createRoute, z } from '@hono/zod-openapi';
import { createRouter } from '@/lib/create-router.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';

/**
 * POST /api/v1/oauth/consent
 *
 * Handles user consent decision (allow/deny).
 * If allowed, stores consent and returns the authorize URL.
 * If denied, returns the error redirect URL.
 */
const route = createRoute({
  method: 'post',
  path: '/consent',
  tags: [TAGS.CONSENT],
  summary: 'Submit consent decision',
  description: 'Handles the user consent decision for OAuth authorization.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
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
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.RedirectUrlResponse,
        },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.OAuthClientNotFound.Schema,
        },
      },
      description: 'OAuth client not found',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const body = c.req.valid('json');
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
  } = body;

  const auth = c.get('auth');
  const { oauthClientService, userConsentService } = c.get('services');

  // Check if user is logged in
  const userSession = await auth.verify();

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

    return c.json({ redirect_url: errorUrl.toString() }, 200);
  }

  // User allowed consent - store it
  const requestedScopes = scope ? scope.split(' ') : [];

  // Look up client to get primary key
  const client = await oauthClientService.findByClientId(client_id);

  await userConsentService.grantConsent({
    userId: userSession.id,
    clientId: client.id,
    scopes: requestedScopes,
  });

  // Build authorize URL to continue the flow
  const url = new URL(c.req.url);
  const authorizeUrl = new URL(
    '/application/oauth/authorize',
    `${url.protocol}//${url.host}`,
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

  return c.json({ redirect_url: authorizeUrl.toString() }, 200);
});
