import z from 'zod/v4';
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
      tags: ['Health'],
      response: {
        200: z.object({
          status: z.literal('ok'),
        }),
      },
    },
    handler: async (_req, res) => {
      return res.status(200).send({
        status: 'ok',
      });
    },
  });
};
