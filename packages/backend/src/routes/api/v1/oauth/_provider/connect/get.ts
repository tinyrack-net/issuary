import z from 'zod';
import { e } from '@/schemas/error.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Initiate OAuth Connect Flow',
      description:
        'Redirects the user to the OAuth provider for authentication',
      tags: ['OAuth Connect'],
      params: z.object({
        provider: z.string().min(1),
      }),
      querystring: z.object({
        mode: z.enum(['login', 'register', 'link']).default('login'),
        return_url: z.string().optional(),
      }),
      response: {
        302: z.void(),
        404: e.OAuthProviderNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      const { provider } = req.params;
      const { mode, return_url } = req.query;

      // Generate authorization URL and session data
      const { url, sessionData } =
        await fastify.oauthConnectService.generateAuthorizationUrl(
          provider,
          mode,
          return_url,
        );

      // Store OAuth session data in secure session
      req.session.set('oauth', sessionData);

      // Redirect to OAuth provider
      return res.redirect(url);
    },
  });
