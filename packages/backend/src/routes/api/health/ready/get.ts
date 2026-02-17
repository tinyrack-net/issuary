import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';

/**
 * GET /health/ready
 *
 * Kubernetes readiness probe endpoint.
 * Returns 200 if the server is ready to accept traffic.
 * Checks database connectivity to ensure all dependencies are available.
 */
export const healthReadyGet = new Hono<AppEnv>().get(
  '/health/ready',
  describeRoute({
    tags: [TAGS.HEALTH],
    summary: 'Readiness probe',
    description:
      'Returns 200 if the server is ready to accept traffic. Checks database connectivity.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.ReadinessResponse),
          },
        },
        description: 'Ready',
      },
      503: {
        content: {
          'application/json': {
            schema: resolver(r.ReadinessErrorResponse),
          },
        },
        description: 'Not ready',
      },
    },
  }),
  async (c) => {
    const { mikro } = c.var.services;

    // Check database connectivity
    let databaseStatus: 'ok' | 'error' = 'error';
    let errorMessage: string | undefined;

    try {
      await mikro.em.getConnection().execute('SELECT 1');
      databaseStatus = 'ok';
    } catch (err) {
      databaseStatus = 'error';
      errorMessage =
        err instanceof Error ? err.message : 'Database connection failed';
    }

    if (databaseStatus === 'ok') {
      return c.json(
        {
          status: 'ok' as const,
          checks: { database: 'ok' as const },
        },
        200,
      );
    }

    return c.json(
      {
        status: 'error' as const,
        checks: { database: databaseStatus },
        error: errorMessage,
      },
      503,
    );
  },
);
