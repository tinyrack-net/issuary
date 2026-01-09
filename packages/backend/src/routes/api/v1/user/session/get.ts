import z from 'zod';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Get Session',
      description: 'Get Session',
      tags: ['User'],
      response: {
        200: z.discriminatedUnion('authenticated', [
          z.object({
            authenticated: z.literal(true),
            user: r.UserSession,
          }),
          z.object({
            authenticated: z.literal(false),
            user: z.null(),
          }),
        ]),
      },
    },
    handler: async (req, res) => {
      const session = req.session.get('user');

      if (session) {
        const user = await fastify.userService.verifyUserById(session.id);
        return res.status(200).send({
          authenticated: true,
          user: {
            id: session.id,
            email: user.email,
            email_verified: true,
          },
        });
      } else {
        return res.status(200).send({
          authenticated: false,
          user: null,
        });
      }
    },
  });
