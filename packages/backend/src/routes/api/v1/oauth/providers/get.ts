import z from 'zod';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'List Available OAuth Providers',
      description: 'Returns all enabled OAuth providers for login/registration',
      tags: ['OAuth Connect'],
      response: {
        200: z.object({
          providers: z.array(
            z.object({
              name: z.string(),
              display_name: z.string(),
              icon_url: z.string().optional(),
            }),
          ),
        }),
      },
    },
    handler: async (_req, res) => {
      const providers = fastify.oauthConnectService.getEnabledProviders();

      return res.status(200).send({ providers });
    },
  });
