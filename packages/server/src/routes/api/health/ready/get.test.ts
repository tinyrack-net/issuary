import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { AppType } from '../../../../entrypoints/app.ts';
import type { ServiceContainer } from '../../../../services/container.ts';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../../test-utils/index.ts';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
  });
  app = server.app;
  services = server.services;
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

  test('should return 503 when database connectivity fails', async () => {
    const executeSpy = vi
      .spyOn(services.mikro.em.getConnection(), 'execute')
      .mockRejectedValueOnce(new Error('readiness failed'));

    const client = testClient(app);
    const res = await client.api.health.ready.$get();

    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body).toEqual({
      status: 'error',
      checks: {
        database: 'error',
      },
      error: 'readiness failed',
    });

    executeSpy.mockRestore();
  });
});
