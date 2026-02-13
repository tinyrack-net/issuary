import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import { MINIMAL_TEST_CONFIG } from '@/test-utils/index.js';
import type { AppType } from '@/types.js';

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

describe('GET /api/v1/health', () => {
  test('should return 200 with full health status when healthy', async () => {
    const res = await app.request('/api/v1/health', {
      method: 'GET',
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('database', 'ok');
  });

  test('should return version as string', async () => {
    const res = await app.request('/api/v1/health', {
      method: 'GET',
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
  });

  test('should return uptime as number', async () => {
    const res = await app.request('/api/v1/health', {
      method: 'GET',
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test('should have consistent response structure', async () => {
    const res = await app.request('/api/v1/health', {
      method: 'GET',
    });

    expect(res.status).toBe(200);

    const body = await res.json();

    // Verify all required fields exist
    expect(body).toMatchObject({
      status: expect.any(String),
      version: expect.any(String),
      uptime: expect.any(Number),
      checks: {
        database: expect.any(String),
      },
    });
  });
});
