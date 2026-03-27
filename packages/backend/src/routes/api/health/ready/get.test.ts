import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../../entrypoints/app.ts';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/health/ready', () => {
  test('should return 200 with database ok when healthy', async () => {
    const client = testClient(app);
    const res = await client.api.health.ready.$get();

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
    const res = await client.api.health.ready.$get();

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('database');
  });
});
