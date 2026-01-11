import { r } from '@/schemas/response.js';
import { TAGS } from '@/lib/swagger-tags.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Get Session',
      description: 'Get Session',
      tags: [TAGS.USER],
      response: {
        200: r.UserSessionNullableResponse,
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
