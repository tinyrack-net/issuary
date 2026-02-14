import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { r } from '@backend/schemas/response.js';
import { createRoute } from '@hono/zod-openapi';

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * GET /health
 *
 * Comprehensive health check endpoint.
 * Returns detailed status information including version, uptime, and dependency checks.
 */
const route = createRoute({
  method: 'get',
  path: '/health',
  tags: [TAGS.HEALTH],
  summary: 'Health check',
  description:
    'Returns comprehensive health status including version, uptime, and dependency checks.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.HealthResponse,
        },
      },
      description: 'Healthy',
    },
    503: {
      content: {
        'application/json': {
          schema: r.HealthErrorResponse,
        },
      },
      description: 'Unhealthy',
    },
  },
});

export const healthGet = createRouter().openapi(route, async (c) => {
  const { mikro } = c.get('services');
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
});
