import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

export const oauthProviderAuthorizeGet = new Hono<AppEnv>().get(
  '/oauth/:provider/authorize',
  describeRoute({
    tags: [TAGS.OAUTH_CONNECT],
    summary: 'Initiate OAuth Authorize Flow',
    description: 'Redirects the user to the OAuth provider for authentication',
    responses: {
      302: {
        description: 'Redirect to OAuth provider',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
      404: {
        content: {
          'application/json': {
            schema: resolver(e.OAuthProviderNotFound.Schema),
          },
        },
        description: 'OAuth provider not found',
      },
    },
  }),
  validator(
    'param',
    z.object({
      provider: f.providerName,
    }),
  ),
  validator(
    'query',
    z.object({
      mode: f.oauthConnectMode.default('login'),
      return_url: f.returnUrl.optional(),
    }),
  ),
  verifyAuth({ optional: true }),
  async (c) => {
    const params = c.req.valid('param');
    const query = c.req.valid('query');
    const { provider } = params;
    const { mode, return_url } = query;
    const session = c.var.session;
    const { oauthConnectService } = c.var.services;

    // Link mode requires authenticated user
    if (mode === 'link') {
      const verifiedUser = c.var.verifiedUser;
      if (!verifiedUser) {
        throw new e.Unauthorized.Error();
      }
    }

    // Generate authorization URL and session data
    const { url, sessionData } =
      await oauthConnectService.generateAuthorizationUrl(
        provider,
        mode,
        return_url,
      );

    // Store OAuth session data in secure session
    session.set('oauth', sessionData);

    // Redirect to OAuth provider
    return c.redirect(url);
  },
);
