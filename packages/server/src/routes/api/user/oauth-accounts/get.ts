import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../lib/openapi.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../middleware/auth.ts';
import { e } from '../../../../schemas/error.ts';
import { r } from '../../../../schemas/response.ts';

export const userOauthAccountsGet = new Hono<AppEnv>().get(
  '/user/oauth-accounts',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'List Linked OAuth Accounts',
    description: 'Returns all OAuth accounts linked to the current user',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.LinkedAccountsResponse),
          },
        },
        description: 'Success',
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
            schema: resolver(e.UserNotFound.Schema),
          },
        },
        description: 'User not found',
      },
    },
  }),
  verifyAuth(),
  async (c) => {
    const { user: userEntity } = c.var.verifiedUser;
    const { oauthConnectService } = c.var.services;

    // Get linked accounts
    const accounts = await oauthConnectService.getLinkedAccounts(
      userEntity.sub,
    );

    // Get all available providers and mark linked ones
    const enabledProviders = await oauthConnectService.getEnabledProviders();
    const linkedProviderNames = new Set(accounts.map((a) => a.provider_name));

    const availableProviders = enabledProviders.map((provider) => ({
      id: provider.id,
      display_name: provider.display_name,
      icon_url: provider.icon_url,
      linked: linkedProviderNames.has(provider.id),
    }));

    return c.json(
      {
        accounts,
        available_providers: availableProviders,
      },
      200,
    );
  },
);
