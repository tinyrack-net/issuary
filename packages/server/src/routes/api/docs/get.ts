import { apiReference } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import type { AppEnv } from '../../../lib/app-env.ts';

/**
 * GET /api/docs
 *
 * Scalar API reference UI for the OpenAPI specification.
 */
export const docsGet = new Hono<AppEnv>().get(
  '/docs',
  describeRoute({
    summary: 'API documentation',
    responses: {
      200: { description: 'API reference UI' },
      404: { description: 'Documentation disabled' },
    },
  }),
  async (c) => {
    const { openapi } = c.var.services.config;

    if (!openapi.enabled) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const scalarApp = new Hono().get(
      '/api/docs',
      apiReference({
        pageTitle: openapi.ui_title,
        url: '/api/docs/json',
      }),
    );

    return scalarApp.fetch(c.req.raw);
  },
);
