import z from 'zod/v4';
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
      tags: ['Health'],
      response: {
        200: z.object({
          status: z.literal('ok'),
          checks: z.object({
            database: z.literal('ok'),
          }),
        }),
        503: z.object({
          status: z.literal('error'),
          checks: z.object({
            database: z.enum(['ok', 'error']),
          }),
          error: z.string().optional(),
        }),
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
