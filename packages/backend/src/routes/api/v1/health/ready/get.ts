import { r } from '@/schemas/response.js';
import { TAGS } from '@/lib/swagger-tags.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * GET /health/ready
 *
 * Kubernetes readiness probe endpoint.
 * Returns 200 if the server is ready to accept traffic.
 * Checks database connectivity to ensure all dependencies are available.
 * Used by Kubernetes to determine if traffic should be routed to this pod.
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Readiness probe',
      description:
        'Returns 200 if the server is ready to accept traffic. Checks database connectivity.',
      tags: [TAGS.HEALTH],
      response: {
        200: r.ReadinessResponse,
        503: r.ReadinessErrorResponse,
      },
    },
    handler: async (_req, res) => {
      // Check database connectivity
      let databaseStatus: 'ok' | 'error' = 'error';
      let errorMessage: string | undefined;

      try {
        // Execute a simple query to verify database connection
        await fastify.mikro.em.getConnection().execute('SELECT 1');
        databaseStatus = 'ok';
      } catch (err) {
        databaseStatus = 'error';
        errorMessage =
          err instanceof Error ? err.message : 'Database connection failed';
      }

      // Return appropriate response based on checks
      if (databaseStatus === 'ok') {
        return res.status(200).send({
          status: 'ok',
          checks: {
            database: 'ok',
          },
        });
      }

      return res.status(503).send({
        status: 'error',
        checks: {
          database: databaseStatus,
        },
        error: errorMessage,
      });
    },
  });
};
