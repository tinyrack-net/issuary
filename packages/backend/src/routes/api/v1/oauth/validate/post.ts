import z from 'zod';
import { UserSessionSchema } from '@/schemas/user.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'OAuth Login 검증',
      description: 'OAuth Login 검증',
      tags: ['User'],
      body: z.object({
        email: z.email(),
        password: z.string().min(6).max(100),
      }),
      response: {
        200: z.object({
          user: UserSessionSchema,
        }),
      },
    },
    handler: async (_req, res) => {
      res.status(200).send({
        user: {
          id: 'asdf',
        },
      });
    },
  });
