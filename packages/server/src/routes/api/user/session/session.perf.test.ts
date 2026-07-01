import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../../test-utils/index.js';
import { runHttpPerf } from '../../../../test-utils/perf/index.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp(MINIMAL_TEST_CONFIG);
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/user/session perf', () => {
  test('smoke handles unauthenticated session requests through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/user/session smoke',
      warmupRequests: 10,
      requests: 100,
      concurrency: 5,
      request: async () => app.request('/api/user/session'),
    });

    expect(result.totalRequests).toBe(100);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(100);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(10);
    expect(result.p95Ms).toBeLessThan(500);
  });
});
