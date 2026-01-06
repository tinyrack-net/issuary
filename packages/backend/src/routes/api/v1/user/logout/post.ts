import z from 'zod';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Purge Session',
      description: 'Purge Session',
      tags: ['User'],
      response: {
        200: z.object({
          ok: z.boolean(),
        }),
      },
    },
    handler: async (req, res) => {
      req.session.delete();
      res.status(200).send({
        ok: true,
      });
    },
  });
