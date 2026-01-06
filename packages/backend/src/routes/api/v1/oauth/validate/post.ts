import { verifyUser } from '@/handlers/verify-user.js';
import { UserSchema } from '@/schemas/user.js';
import type { FastifyWithZodInstance } from '@/server.js';
import z from 'zod';

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
          user: UserSchema,
        }),
      },
    },
    handler: async (req, res) => {
      const user = await verifyUser({
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
