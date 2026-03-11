import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { createTestApp, MINIMAL_TEST_CONFIG } from './setup.js';

describe('createTestApp', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp();
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('creates an app from the minimal resolved test config', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get();

    expect(res.status).toBe(200);
  });

  test('accepts overridden resolved config', async () => {
    const server = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        server: {
          public_origin: 'http://localhost:9090',
        },
      },
    });

    try {
      const res = await server.app.request('/login');
      expect(res.status).toBe(404);
    } finally {
      await server.cleanup();
    }
  });
});
