import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../lib/openapi.ts';
import { parseScopesWithDescriptions } from '../../../lib/scopes.ts';
import { TAGS } from '../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../middleware/auth.ts';
import { e } from '../../../schemas/error.ts';
import { f } from '../../../schemas/field.ts';
import { r } from '../../../schemas/response.ts';

/**
 * GET /api/oauth/consent
 *
 * Returns consent page data including client information and requested scopes.
 * Used by the frontend consent page to display consent details.
 */
export const consentGet = new Hono<AppEnv>().get(
  '/consent',
  describeRoute({
    tags: [TAGS.CONSENT],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Get consent information',
    description:
      'Returns OAuth client information and requested scopes for the consent page.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.ConsentInfoResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(
              z.union([
                e.OAuthClientNotFound.Schema,
                e.OAuthClientDisabled.Schema,
                e.InvalidRedirectUri.Schema,
                e.UnsupportedResponseType.Schema,
                e.InvalidScope.Schema,
              ]),
            ),
          },
        },
        description: 'Invalid authorization context',
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
    'query',
    z.object({
      client_id: f.clientId,
      redirect_uri: f.redirectUri,
      response_type: f.responseType,
      prompt: f.prompt.optional(),
      scope: f.scope.optional(),
    }),
  ),
  verifyAuth(),
  async (c) => {
    const query = c.req.valid('query');
    const { client_id, scope } = query;
    const { user: userEntity } = c.var.verifiedUser;
    const { oauthClientService, userConsentService } = c.var.services;

    // Fetch OAuth client information
    const client = await oauthClientService.findByClientId(client_id);
    oauthClientService.validateEnabled(client);
    oauthClientService.validateRedirectUri(client, query.redirect_uri);
    oauthClientService.validateResponseType(client, query.response_type);
    const requestedScopes = scope ? scope.split(' ') : [];
    oauthClientService.validateScopes(client, requestedScopes);
    const grantedScopes = await userConsentService.resolveScopes({
      userSub: userEntity.sub,
      clientId: client.id,
      requestedScopes,
      responseType: query.response_type,
      prompt: query.prompt,
      skipConsent: client.skipConsent,
    });

    // Parse requested scopes with descriptions
    const scopes = parseScopesWithDescriptions(grantedScopes.join(' '));

    return c.json(
      {
        client: {
          id: client.id,
          clientId: client.clientId,
          name: client.name,
        },
        scopes,
        user: {
          sub: userEntity.sub,
          email: userEntity.email,
        },
      },
      200,
    );
  },
);
