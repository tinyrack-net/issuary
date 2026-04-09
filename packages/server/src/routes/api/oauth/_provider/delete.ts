import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../lib/openapi.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../middleware/auth.ts';
import { e } from '../../../../schemas/error.ts';
import { f } from '../../../../schemas/field.ts';
import { r } from '../../../../schemas/response.ts';

export const oauthProviderDelete = new Hono<AppEnv>().delete(
  '/oauth/:provider',
  describeRoute({
    tags: [TAGS.OAUTH_CONNECT],
    security: OPENAPI_SECURITY.cookieSession,
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
    const { user: userEntity } = c.var.verifiedUser;
    const { oauthConnectService } = c.var.services;

    const { provider } = params;

    // Verify provider exists
    oauthConnectService.getProvider(provider);

    // Unlink the OAuth account
    await oauthConnectService.unlinkOAuthAccount(userEntity.sub, provider);

    return c.json({ ok: true as const }, 200);
  },
);
