import type { AppType } from '@backend/lib/app.js';
import { createServer } from '@backend/server.js';
import {
  createTestClient,
  MINIMAL_TEST_CONFIG,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
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
  // Note: /api/docs/json is registered via app.doc31() and is NOT part of
  // the typed route system, so we use app.request() for these tests.
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
    expect(body.paths).toHaveProperty('/api/v1/health');
  });
});

describe('GET /api/docs', () => {
  test('should return 200 with Scalar API reference HTML', async () => {
    const client = createTestClient(app);
    const res = await client.api.docs.$get();

    expect(res.status).toBe(200);

    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('text/html');
  });
});
