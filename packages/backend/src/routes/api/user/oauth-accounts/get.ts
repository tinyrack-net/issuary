import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';

export const userOauthAccountsGet = new Hono<AppEnv>().get(
  '/user/oauth-accounts',
  describeRoute({
    tags: [TAGS.USER],
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
    const userEntity = c.var.verifiedUser;
    const { oauthConnectService } = c.var.services;

    // Get linked accounts
    const accounts = await oauthConnectService.getLinkedAccounts(
      userEntity.sub,
    );

    // Get all available providers and mark linked ones
    const enabledProviders = oauthConnectService.getEnabledProviders();
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
