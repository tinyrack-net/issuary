import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { AppType } from '../../../entrypoints/app.ts';
import type { ServiceContainer } from '../../../services/container.ts';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.ts';

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

describe('GET /api/health', () => {
  test('should return 200 with full health status when healthy', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get();

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('database', 'ok');
  });

  test('should return uptime as number', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get();

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test('should have consistent response structure', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get();

    expect(res.status).toBe(200);

    const body = await res.json();

    // Verify all required fields exist
    expect(body).toMatchObject({
      status: expect.any(String),
      uptime: expect.any(Number),
      checks: {
        database: expect.any(String),
      },
    });
  });

  test('should return 503 with error details when database check fails', async () => {
    const executeSpy = vi
      .spyOn(services.mikro.em.getConnection(), 'execute')
      .mockRejectedValueOnce(new Error('database unavailable'));

    const client = testClient(app);
    const res = await client.api.health.$get();

    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body).toMatchObject({
      status: 'error',
      checks: {
        database: 'error',
      },
    });
    if (!('error' in body)) {
      throw new Error('Expected health error response');
    }
    expect(body.error).toContain('database unavailable');

    executeSpy.mockRestore();
  });
});
