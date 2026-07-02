import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { parseScopesWithDescriptions } from '../../../../lib/scopes.ts';
import { e } from '../../../../schemas/error.ts';
import { f } from '../../../../schemas/field.ts';
import { r } from '../../../../schemas/response.ts';

/**
 * GET /api/oauth/authorization-context
 *
 * Returns a server-validated summary of an OAuth/OIDC authorization request.
 * This is safe for pre-authentication UI because it only returns data after
 * client, redirect URI, response type, and scopes have been validated.
 */
export const authorizationContextGet = new Hono<AppEnv>().get(
  '/oauth/authorization-context',
  describeRoute({
    tags: ['OAuth'],
    summary: 'Get authorization request context',
    description:
      'Returns validated OAuth client and scope information for login and registration screens.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.AuthorizationContextResponse),
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
        description: 'Invalid authorization request context',
      },
    },
  }),
  validator(
    'query',
    z.object({
      client_id: f.clientId,
      redirect_uri: f.redirectUri,
      response_type: f.responseType,
      scope: f.scope.optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid('query');
    const { oauthClientService } = c.var.services;

    const client = await oauthClientService.findByClientId(query.client_id);
    oauthClientService.validateEnabled(client);
    oauthClientService.validateRedirectUri(client, query.redirect_uri);
    oauthClientService.validateResponseType(client, query.response_type);

    const requestedScopes = query.scope
      ? query.scope.split(' ').filter((scope) => scope.length > 0)
      : [];
    oauthClientService.validateScopes(client, requestedScopes);

    return c.json(
      {
        client: {
          id: client.id,
          clientId: client.clientId,
          name: client.name,
        },
        redirect_uri: query.redirect_uri,
        redirect_origin: new URL(query.redirect_uri).origin,
        scopes: parseScopesWithDescriptions(query.scope),
      },
      200,
    );
  },
);
