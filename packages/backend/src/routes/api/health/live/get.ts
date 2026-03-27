import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { r } from '../../../../schemas/response.ts';

/**
 * GET /health/live
 *
 * Kubernetes liveness probe endpoint.
 * Returns 200 if the server is running and can respond to requests.
 */
export const healthLiveGet = new Hono<AppEnv>().get(
  '/health/live',
  describeRoute({
    tags: [TAGS.HEALTH],
    summary: 'Liveness probe',
    description:
      'Returns 200 if the server is alive. Used by Kubernetes liveness probe.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.LivenessResponse),
          },
        },
        description: 'Alive',
      },
    },
  }),
  async (c) => {
    return c.json({ status: 'ok' as const }, 200);
  },
);
