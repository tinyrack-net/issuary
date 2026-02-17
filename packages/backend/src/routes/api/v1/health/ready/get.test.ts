import type { AppType } from '@backend/app.js';
import { createServer } from '@backend/server.js';
import { MINIMAL_TEST_CONFIG } from '@backend/test-utils/index.js';
import { testClient } from 'hono/testing';
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

describe('GET /api/v1/health/ready', () => {
  test('should return 200 with database ok when healthy', async () => {
    const client = testClient(app);
    const res = await client.api.v1.health.ready.$get();

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      status: 'ok',
      checks: {
        database: 'ok',
      },
    });
  });

  test('should have proper response structure', async () => {
    const client = testClient(app);
    const res = await client.api.v1.health.ready.$get();

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('database');
  });
});
