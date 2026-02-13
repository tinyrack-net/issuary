import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  fastify.route({
    method: 'POST',
    url: '/auth/logout',
    schema: {
      summary: 'Logout',
      description: 'Logout the current user and purge the session',
      tags: [TAGS.AUTH],
      response: {
        200: r.OkResponse,
      },
    },
    handler: async (req, res) => {
      req.session.delete();
      res.status(200).send({
        ok: true,
      });
    },
  });
};
