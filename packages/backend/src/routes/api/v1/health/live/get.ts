import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * GET /health/live
 *
 * Kubernetes liveness probe endpoint.
 * Returns 200 if the server is running and can respond to requests.
 * Used by Kubernetes to determine if the pod should be restarted.
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Liveness probe',
      description:
        'Returns 200 if the server is alive. Used by Kubernetes liveness probe.',
      tags: [TAGS.HEALTH],
      response: {
        200: r.LivenessResponse,
      },
    },
    handler: async (_req, res) => {
      return res.status(200).send({
        status: 'ok',
      });
    },
  });
};
