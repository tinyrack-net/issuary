import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entries/app.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '#backend/test-utils/index.js';

describe('createApp', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({ config: MINIMAL_TEST_CONFIG });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('serves backend routes normally', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get();

    expect(res.status).toBe(200);
  });

  test('returns JSON 404 for frontend routes', async () => {
    const res = await app.request('/login');

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not Found' });
  });
});
