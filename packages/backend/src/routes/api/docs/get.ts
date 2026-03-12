import { apiReference } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import type { AppEnv } from '#backend/lib/app-env.js';

/**
 * GET /api/docs
 *
 * Scalar API reference UI for the OpenAPI specification.
 */
export const docsGet = new Hono<AppEnv>().get('/docs', async (c) => {
  const { openapi } = c.var.services.config;

  if (!openapi.enabled) {
    return c.json({ error: 'Not Found' }, 404);
  }

  const scalarApp = new Hono().get(
    '/api/docs',
    apiReference({
      pageTitle: openapi.ui_title,
      spec: {
        url: '/api/docs/json',
      },
    }),
  );

  return scalarApp.fetch(c.req.raw);
});
