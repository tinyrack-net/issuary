import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '@/lib/create-router.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';

const route = createRoute({
  method: 'get',
  path: '/user/oauth-accounts',
  tags: [TAGS.USER],
  summary: 'List Linked OAuth Accounts',
  description: 'Returns all OAuth accounts linked to the current user',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.LinkedAccountsResponse,
        },
      },
      description: 'Success',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
    404: {
      content: {
        'application/json': {
          schema: e.UserNotFound.Schema,
        },
      },
      description: 'User not found',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const auth = c.get('auth');
  const { oauthConnectService } = c.get('services');

  // Check if user is logged in
  const userSession = await auth.verify();

  // Get linked accounts
  const accounts = await oauthConnectService.getLinkedAccounts(userSession.id);

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
});
