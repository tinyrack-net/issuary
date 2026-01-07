import z from 'zod';
import { UserSchema } from '@/schemas/user.js';
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
          user: UserSchema.nullable(),
        }),
      },
    },
    handler: async (req, res) => {
      const session = req.session.get('user');

      if (session) {
        return res.status(200).send({
          user: {
            id: session.id,
          },
        });
      } else {
        return res.status(200).send({
          user: null,
        });
      }
    },
  });
