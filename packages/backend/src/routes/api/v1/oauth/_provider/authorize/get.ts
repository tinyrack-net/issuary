import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '/oauth/:provider/authorize',
    schema: {
      summary: 'Initiate OAuth Authorize Flow',
      description:
        'Redirects the user to the OAuth provider for authentication',
      tags: [TAGS.OAUTH_CONNECT],
      params: z.object({
        provider: f.providerName,
      }),
      querystring: z.object({
        mode: f.oauthConnectMode.default('login'),
        return_url: f.returnUrl.optional(),
      }),
      response: {
        302: z.void(),
        401: e.Unauthorized.Schema,
        404: e.OAuthProviderNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      const { provider } = req.params;
      const { mode, return_url } = req.query;

      // Link mode requires authenticated user
      if (mode === 'link') {
        await req.auth.verify();
      }

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
