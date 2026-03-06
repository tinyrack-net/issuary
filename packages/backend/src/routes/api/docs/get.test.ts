import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entries/app.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '#backend/test-utils/index.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    config: {
      ...MINIMAL_TEST_CONFIG,
    },
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/docs/json', () => {
  // /api/docs/json is registered directly on the app, not in the typed
  // route tree, so these tests use app.request().
  test('should return 200 with valid OpenAPI 3.1.0 JSON spec', async () => {
    const res = await app.request('/api/docs/json', {
      method: 'GET',
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('openapi', '3.1.0');
    expect(body).toHaveProperty('info');
    expect(body.info).toHaveProperty('title', 'TinyAuth API');
    expect(body.info).toHaveProperty('version', '1.0.0');
  });

  test('should include paths in the spec', async () => {
    const res = await app.request('/api/docs/json', {
      method: 'GET',
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('paths');
    expect(Object.keys(body.paths).length).toBeGreaterThan(0);
  });

  test('should include health endpoint in paths', async () => {
    const res = await app.request('/api/docs/json', {
      method: 'GET',
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.paths).toHaveProperty('/api/health');
  });

  test('should include security schemes for cookie and bearer auth', async () => {
    const res = await app.request('/api/docs/json', {
      method: 'GET',
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.components).toBeDefined();
    expect(body.components.securitySchemes).toBeDefined();
    expect(body.components.securitySchemes).toHaveProperty('cookieSessionAuth');
    expect(body.components.securitySchemes).toHaveProperty('bearerAuth');
  });
});

describe('GET /api/docs', () => {
  test('should return 200 with Scalar API reference HTML', async () => {
    const client = testClient(app);
    const res = await client.api.docs.$get();

    expect(res.status).toBe(200);

    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('text/html');
  });
});
