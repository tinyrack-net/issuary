import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import { TAGS } from '@/lib/swagger-tags.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'List Linked OAuth Accounts',
      description: 'Returns all OAuth accounts linked to the current user',
      tags: [TAGS.USER],
      response: {
        200: r.LinkedAccountsResponse,
        401: e.Unauthorized.Schema,
        404: e.UserNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      // Check if user is logged in
      const userSession = await req.auth.verify();

      // Get linked accounts
      const accounts = await fastify.oauthConnectService.getLinkedAccounts(
        userSession.id,
      );

      // Get all available providers and mark linked ones
      const enabledProviders =
        fastify.oauthConnectService.getEnabledProviders();
      const linkedProviderNames = new Set(accounts.map((a) => a.provider_name));

      const availableProviders = enabledProviders.map((provider) => ({
        name: provider.name,
        display_name: provider.display_name,
        icon_url: provider.icon_url,
        linked: linkedProviderNames.has(provider.name),
      }));

      return res.status(200).send({
        accounts,
        available_providers: availableProviders,
      });
    },
  });
