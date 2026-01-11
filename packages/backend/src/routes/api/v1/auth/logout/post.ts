import z from 'zod/v4';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Logout',
      description: 'Logout the current user and purge the session',
      tags: ['Auth'],
      response: {
        200: z.object({
          ok: z.literal(true),
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
