import z from 'zod';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'OAuth Login',
      description: 'OAuth Login',
      tags: ['User'],
      body: z.object({
        email: z.email(),
        password: z.string().min(6).max(100),
      }),
      response: {
        200: z.object({
          user: r.UserSession,
        }),
      },
    },
    handler: async (_req, res) => {
      res.status(200).send({
        user: {
          managed: 'database',
          id: 'asdf',
          email: '',
          email_verified: false,
        },
      });
    },
  });
