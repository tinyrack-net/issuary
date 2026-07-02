import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '#server/entrypoints/app.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '#server/test-utils/index.js';
import { runHttpPerf } from '#server/test-utils/perf/index.js';

const WARMUP_REQUESTS = 5;
const MEASURED_REQUESTS = 50;

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

async function requestJwks() {
  const response = await app.request('/oauth/.well-known/jwks');
  const body = await response.clone().json();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
  expect(body).toEqual({
    keys: expect.arrayContaining([
      expect.objectContaining({
        kty: 'RSA',
        use: 'sig',
        kid: expect.any(String),
        alg: 'RS256',
        n: expect.any(String),
        e: expect.any(String),
      }),
    ]),
  });

  return response;
}

describe('GET /oauth/.well-known/jwks perf', () => {
  test('serves signing key metadata through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /oauth/.well-known/jwks smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestJwks,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
