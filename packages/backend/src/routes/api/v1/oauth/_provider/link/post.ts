import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Initiate OAuth Link Flow',
      description: 'Redirects the user to OAuth provider to link their account',
      tags: [TAGS.OAUTH_CONNECT],
      params: z.object({
        provider: f.providerName,
      }),
      querystring: z.object({
        return_url: z.string().optional(),
      }),
      response: {
        302: z.void(),
        401: e.Unauthorized.Schema,
        404: e.OAuthProviderNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      await req.auth.verify();

      const { provider } = req.params;
      const { return_url } = req.query;

      const { url, sessionData } =
        await fastify.oauthConnectService.generateAuthorizationUrl(
          provider,
          'link',
          return_url,
        );

      req.session.set('oauth', sessionData);
      return res.redirect(url);
    },
  });
