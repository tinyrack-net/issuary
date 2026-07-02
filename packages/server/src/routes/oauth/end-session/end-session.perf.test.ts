import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

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

async function requestDefaultEndSessionRedirect() {
  const response = await app.request('/oauth/end_session');

  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe('http://localhost:8080');
  expect(response.headers.get('set-cookie')).toContain('session=');

  return response;
}

describe('GET /oauth/end_session perf', () => {
  test('clears the session cookie and redirects through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /oauth/end_session default redirect smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [302],
      request: requestDefaultEndSessionRedirect,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[302]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
