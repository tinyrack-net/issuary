import z from 'zod';
import { e } from '@/schemas/error.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'List Linked OAuth Accounts',
      description: 'Returns all OAuth accounts linked to the current user',
      tags: ['User'],
      response: {
        200: z.object({
          accounts: z.array(
            z.object({
              provider_name: z.string(),
              linked_at: z.date(),
            }),
          ),
          available_providers: z.array(
            z.object({
              name: z.string(),
              display_name: z.string(),
              icon_url: z.string().optional(),
              linked: z.boolean(),
            }),
          ),
        }),
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
