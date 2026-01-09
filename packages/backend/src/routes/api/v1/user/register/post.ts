import z from 'zod/v4';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
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
        email: f.userEmail,
        password: f.userPassword,
      }),
      response: {
        200: z.object({
          user: r.UserSession,
        }),
      },
    },
    handler: async (req, res) => {
      const user = await fastify.userService.register({
        email: req.body.email,
        password: req.body.password,
      });

      req.session.set('user', {
        id: user.id,
      });

      res.status(200).send({
        user: {
          id: user.id,
          email: user.email,
          email_verified: user.email_verified,
        },
      });
    },
  });
