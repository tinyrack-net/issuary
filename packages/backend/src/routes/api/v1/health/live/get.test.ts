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

describe('GET /api/v1/health/live', () => {
  test('should return 200 with status ok', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.health.live.$get();

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      status: 'ok',
    });
  });

  test('should respond quickly (no heavy operations)', async () => {
    const client = createTestClient(app);
    const start = Date.now();

    const res = await client.api.v1.health.live.$get();

    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(100); // Should respond within 100ms
  });
});
