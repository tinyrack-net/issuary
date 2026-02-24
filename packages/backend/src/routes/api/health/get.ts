import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import type { AppEnv } from '#backend/lib/app-env.js';
import { TAGS } from '#backend/lib/swagger-tags.js';
import { r } from '#backend/schemas/response.js';

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * GET /health
 *
 * Comprehensive health check endpoint.
 * Returns detailed status information including version, uptime, and dependency checks.
 */
export const healthGet = new Hono<AppEnv>().get(
  '/health',
  describeRoute({
    tags: [TAGS.HEALTH],
    summary: 'Health check',
    description:
      'Returns comprehensive health status including version, uptime, and dependency checks.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.HealthResponse),
          },
        },
        description: 'Healthy',
      },
      503: {
        content: {
          'application/json': {
            schema: resolver(r.HealthErrorResponse),
          },
        },
        description: 'Unhealthy',
      },
    },
  }),
  async (c) => {
    const { mikro } = c.var.services;
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const version = process.env['npm_package_version'] || '1.0.0';

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
          version,
          uptime,
          checks: { database: 'ok' as const },
        },
        200,
      );
    }

    return c.json(
      {
        status: 'error' as const,
        version,
        uptime,
        checks: { database: databaseStatus },
        error: errorMessage,
      },
      503,
    );
  },
);
