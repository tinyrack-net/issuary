import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '#backend/lib/app-env.js';
import { OPENAPI_SECURITY } from '#backend/lib/openapi.js';
import { TAGS } from '#backend/lib/swagger-tags.js';
import { verifyAuth } from '#backend/middleware/auth.js';
import { e } from '#backend/schemas/error.js';
import { f } from '#backend/schemas/field.js';
import { r } from '#backend/schemas/response.js';

/**
 * POST /api/oauth/consent
 *
 * Handles user consent decision (allow/deny).
 * If allowed, stores consent and returns the authorize URL.
 * If denied, returns the error redirect URL.
 */
export const consentPost = new Hono<AppEnv>().post(
  '/consent',
  describeRoute({
    tags: [TAGS.CONSENT],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Submit consent decision',
    description: 'Handles the user consent decision for OAuth authorization.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.RedirectUrlResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.OAuthClientNotFound.Schema),
          },
        },
        description: 'OAuth client not found',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
    },
  }),
  validator(
    'json',
    z.object({
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
  ),
  verifyAuth(),
  async (c) => {
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

    const { user: userEntity } = c.var.verifiedUser;
    const { oauthClientService, userConsentService } = c.var.services;

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
      userSub: userEntity.sub,
      clientId: client.id,
      scopes: requestedScopes,
    });

    // Build authorize URL to continue the flow
    const url = new URL(c.req.url);
    const authorizeUrl = new URL(
      '/oauth/authorize',
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
  },
);
