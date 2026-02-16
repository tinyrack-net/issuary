import type { AppEnv } from '@backend/lib/app-env.js';
import { apiReference } from '@scalar/hono-api-reference';
import { Hono } from 'hono';

/**
 * GET /api/docs
 *
 * Scalar API reference UI for the OpenAPI specification.
 */
export const docsGet = new Hono<AppEnv>().get(
  '/docs',
  apiReference({
    pageTitle: 'TinyAuth API Reference',
    spec: {
      url: '/api/docs/json',
    },
  }),
);
