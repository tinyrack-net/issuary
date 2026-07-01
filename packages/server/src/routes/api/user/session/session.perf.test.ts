import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import {
  createAuthenticatedSession,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
} from '../../../../test-utils/index.js';
import { runHttpPerf } from '../../../../test-utils/perf/index.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
  });
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

  test('smoke handles authenticated session-cookie requests through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const result = await runHttpPerf({
      name: 'GET /api/user/session authenticated smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: async () => {
        const response = await app.request('/api/user/session', {
          headers: { Cookie: `session=${sessionCookie}` },
        });
        const body = await response.clone().json();

        expect(body).toEqual({
          user: expect.objectContaining({
            sub: expect.any(String),
          }),
        });

        return response;
      },
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
