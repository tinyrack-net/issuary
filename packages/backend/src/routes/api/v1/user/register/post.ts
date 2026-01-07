import z from 'zod/v4';
import { UserSchema } from '@/schemas/user.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Register',
      description: 'Register a new user',
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
    handler: async (req, res) => {
      const user = await fastify.mikro.user.register({
        email: req.body.email,
        password: req.body.password,
      });

      req.session.set('user', {
        id: user.id,
      });

      res.status(200).send({
        user: {
          id: user.id,
        },
      });
    },
  });
