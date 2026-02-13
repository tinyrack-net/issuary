import { createRoute } from '@hono/zod-openapi';
import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

/**
 * GET /health/live
 *
 * Kubernetes liveness probe endpoint.
 * Returns 200 if the server is running and can respond to requests.
 */
const route = createRoute({
  method: 'get',
  path: '/health/live',
  tags: [TAGS.HEALTH],
  summary: 'Liveness probe',
  description:
    'Returns 200 if the server is alive. Used by Kubernetes liveness probe.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.LivenessResponse,
        },
      },
      description: 'Alive',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    return c.json({ status: 'ok' as const }, 200);
  });
};
