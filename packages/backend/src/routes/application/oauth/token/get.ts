import z from 'zod';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Token',
      description: 'OAuth2 Token Endpoint',
      tags: ['OpenID'],
      params: z.object({
        provider_id: z.string(),
      }),
      response: {
        200: z.object({
          ok: z.boolean(),
        }),
      },
    },
    handler: async (req, res) => {
    },
  });
};
