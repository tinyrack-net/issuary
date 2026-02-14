import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '@/lib/create-router.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';

/**
 * GET /health/ready
 *
 * Kubernetes readiness probe endpoint.
 * Returns 200 if the server is ready to accept traffic.
 * Checks database connectivity to ensure all dependencies are available.
 */
const route = createRoute({
  method: 'get',
  path: '/health/ready',
  tags: [TAGS.HEALTH],
  summary: 'Readiness probe',
  description:
    'Returns 200 if the server is ready to accept traffic. Checks database connectivity.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.ReadinessResponse,
        },
      },
      description: 'Ready',
    },
    503: {
      content: {
        'application/json': {
          schema: r.ReadinessErrorResponse,
        },
      },
      description: 'Not ready',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const { mikro } = c.get('services');

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
});
