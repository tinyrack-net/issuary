import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

export const oauthProviderDelete = new Hono<AppEnv>().delete(
  '/oauth/:provider',
  describeRoute({
    tags: [TAGS.OAUTH_CONNECT],
    summary: 'Unlink OAuth Account',
    description: 'Unlinks an OAuth provider from the current user',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.OkResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.CannotUnlinkLastAuthMethod.Schema),
          },
        },
        description: 'Cannot unlink last auth method',
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
        description:
          'OAuth provider not found, account not linked, or user not found',
      },
    },
  }),
  validator(
    'param',
    z.object({
      provider: f.providerName,
    }),
  ),
  verifyAuth(),
  async (c) => {
    const params = c.req.valid('param');
    const userSession = c.var.verifiedUser;
    const { oauthConnectService } = c.var.services;

    const { provider } = params;

    // Verify provider exists
    oauthConnectService.getProvider(provider);

    // Unlink the OAuth account
    await oauthConnectService.unlinkOAuthAccount(userSession.id, provider);

    return c.json({ ok: true as const }, 200);
  },
);
