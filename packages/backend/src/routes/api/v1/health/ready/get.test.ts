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

describe('GET /api/v1/health/ready', () => {
  test('should return 200 with database ok when healthy', async () => {
    const res = await app.request('/api/v1/health/ready', {
      method: 'GET',
    });

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
    const res = await app.request('/api/v1/health/ready', {
      method: 'GET',
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('database');
  });
});
