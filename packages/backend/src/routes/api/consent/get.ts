import type { AppEnv } from '@backend/lib/app-env.js';
import { parseScopesWithDescriptions } from '@backend/lib/scopes.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

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
    'query',
    z.object({
      client_id: f.clientId,
      scope: f.scope.optional(),
    }),
  ),
  verifyAuth(),
  async (c) => {
    const query = c.req.valid('query');
    const { client_id, scope } = query;
    const userEntity = c.var.verifiedUser;
    const { oauthClientService } = c.var.services;

    // Fetch OAuth client information
    const client = await oauthClientService.findByClientId(client_id);

    // Parse requested scopes with descriptions
    const scopes = parseScopesWithDescriptions(scope);

    return c.json(
      {
        client: {
          id: client.id,
          clientId: client.clientId,
          name: client.name,
        },
        scopes,
        user: {
          id: userEntity.id,
          email: userEntity.email,
        },
      },
      200,
    );
  },
);
