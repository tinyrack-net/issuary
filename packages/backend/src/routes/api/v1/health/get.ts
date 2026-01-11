import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * GET /health
 *
 * Comprehensive health check endpoint.
 * Returns detailed status information including version, uptime, and dependency checks.
 * Useful for debugging and monitoring dashboards.
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Health check',
      description:
        'Returns comprehensive health status including version, uptime, and dependency checks.',
      tags: [TAGS.HEALTH],
      response: {
        200: r.HealthResponse,
        503: r.HealthErrorResponse,
      },
    },
    handler: async (_req, res) => {
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      const version = process.env['npm_package_version'] || '1.0.0';

      // Check database connectivity
      let databaseStatus: 'ok' | 'error' = 'error';
      let errorMessage: string | undefined;

      try {
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
          version,
          uptime,
          checks: {
            database: 'ok',
          },
        });
      }

      return res.status(503).send({
        status: 'error',
        version,
        uptime,
        checks: {
          database: databaseStatus,
        },
        error: errorMessage,
      });
    },
  });
};
