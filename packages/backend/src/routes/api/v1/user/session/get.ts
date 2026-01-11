import z from 'zod/v4';
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
        200: z.object({
          user: r.UserSession.nullable(),
        }),
      },
    },
    handler: async (req, res) => {
      try {
        const user = await req.auth.verify();
        return res.status(200).send({
          user: {
            id: user.id,
            managed: user.managed,
            email: user.email,
            email_verified: user.email_verified,
          },
        });
      } catch {
        return res.status(200).send({
          user: null,
        });
      }
    },
  });
