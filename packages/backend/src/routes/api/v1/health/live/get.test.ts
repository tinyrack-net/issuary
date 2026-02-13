import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '@/lib/app.js';
import { createServer } from '@/server.js';
import { MINIMAL_TEST_CONFIG } from '@/test-utils/index.js';

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

describe('GET /api/v1/health/live', () => {
  test('should return 200 with status ok', async () => {
    const res = await app.request('/api/v1/health/live', {
      method: 'GET',
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      status: 'ok',
    });
  });

  test('should respond quickly (no heavy operations)', async () => {
    const start = Date.now();

    const res = await app.request('/api/v1/health/live', {
      method: 'GET',
    });

    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(100); // Should respond within 100ms
  });
});
