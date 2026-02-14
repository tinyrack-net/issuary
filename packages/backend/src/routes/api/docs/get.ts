import { createRouter } from '@backend/lib/create-router.js';
import { apiReference } from '@scalar/hono-api-reference';

/**
 * GET /api/docs
 *
 * Scalar API reference UI for the OpenAPI specification.
 */
export const docsGet = createRouter().get(
  '/docs',
  apiReference({
    pageTitle: 'TinyAuth API Reference',
    spec: {
      url: '/api/docs/json',
    },
  }),
);
