import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.js';
import { TAGS } from '../../../lib/swagger-tags.js';
import { r } from '../../../schemas/response.js';

export const endSessionGet = new Hono<AppEnv>().get(
  '/end_session',
  describeRoute({
    tags: [TAGS.OPENID],
    summary: 'End Session',
    description: 'RP-initiated logout endpoint',
    responses: {
      302: { description: 'Redirect after logout' },
      400: {
        content: {
          'application/json': {
            schema: resolver(r.OAuthError),
          },
        },
        description: 'Invalid logout request',
      },
    },
  }),
  validator(
    'query',
    z.object({
      client_id: z.string().min(1).optional(),
      post_logout_redirect_uri: z.url().optional(),
      id_token_hint: z.string().min(1).optional(),
      state: z.string().min(1).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid('query');
    const { config, jwtService, oauthClientService } = c.var.services;

    if (!query.post_logout_redirect_uri) {
      deleteCookie(c, 'session', { path: '/' });
      return c.redirect(config.server.public_origin);
    }

    let clientId = query.client_id;
    if (query.id_token_hint) {
      try {
        const idTokenPayload = await jwtService.verifyIdToken(
          query.id_token_hint,
        );
        const audience = idTokenPayload.aud;
        if (typeof audience !== 'string') {
          return c.json(
            {
              error: 'invalid_request',
              error_description:
                'id_token_hint audience must identify exactly one client.',
            },
            400,
          );
        }
        if (clientId && audience !== clientId) {
          return c.json(
            {
              error: 'invalid_request',
              error_description:
                'id_token_hint audience does not match client_id.',
            },
            400,
          );
        }
        clientId = clientId ?? audience;
      } catch {
        return c.json(
          {
            error: 'invalid_request',
            error_description: 'Invalid id_token_hint.',
          },
          400,
        );
      }
    }

    if (!clientId) {
      return c.json(
        {
          error: 'invalid_request',
          error_description:
            'client_id is required for post_logout_redirect_uri when id_token_hint is not provided.',
        },
        400,
      );
    }

    const client = await oauthClientService.findByClientId(clientId);

    try {
      oauthClientService.validatePostLogoutRedirectUri(
        client,
        query.post_logout_redirect_uri,
      );
    } catch {
      return c.json(
        {
          error: 'invalid_request',
          error_description: 'Invalid post_logout_redirect_uri.',
        },
        400,
      );
    }

    const redirectUrl = new URL(query.post_logout_redirect_uri);
    if (query.state) {
      redirectUrl.searchParams.set('state', query.state);
    }

    deleteCookie(c, 'session', { path: '/' });
    return c.redirect(redirectUrl.toString());
  },
);
