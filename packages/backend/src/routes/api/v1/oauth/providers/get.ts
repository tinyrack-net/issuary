import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'List Available OAuth Providers',
      description: 'Returns all enabled OAuth providers for login/registration',
      tags: [TAGS.OAUTH_CONNECT],
      response: {
        200: r.ProvidersResponse,
      },
    },
    handler: async (_req, res) => {
      const providers = fastify.oauthConnectService.getEnabledProviders();

      return res.status(200).send({ providers });
    },
  });
