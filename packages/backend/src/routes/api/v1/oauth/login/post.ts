import z from 'zod';
import { UserSchema } from '@/schemas/user.js';
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
          user: UserSchema,
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
