import z from 'zod/v4';
import { e } from '@/schemas/error.js';
import { UserSessionSchema } from '@/schemas/user.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Login',
      description: 'Login',
      tags: ['User'],
      body: z.object({
        email: z.email(),
        password: z.string().min(6).max(100),
      }),
      response: {
        200: z.object({
          user: UserSessionSchema,
        }),
        400: e.ValidationError.Schema,
        401: e.InvalidEmailOrPassword.Schema,
      },
    },
    handler: async (req, res) => {
      const user = await fastify.userService.login({
        email: req.body.email,
        password: req.body.password,
      });

      req.session.set('user', {
        id: user.id,
      });

      return res.status(200).send({
        user: {
          id: user.id,
          email: user.email,
          email_verified: true,
        },
      });
    },
  });
