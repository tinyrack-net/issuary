import z from 'zod';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Healthcheck',
      tags: ['Misc'],
      response: {
        200: z.object({
          ok: z.boolean(),
        }),
      },
    },
    handler: async (_req, res) => {
      res.send({
        ok: true,
      });
    },
  });
