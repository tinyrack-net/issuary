import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

let app: AppType;
let cleanup: () => Promise<void> = async () => {};

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function requestDocs() {
  const response = await app.request('/api/docs');
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/html');
  expect(body).toContain('TinyAuth API');

  return response;
}

describe('OpenAPI docs perf', () => {
  test('GET /api/docs handles repeated Scalar UI requests through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/docs smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestDocs,
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
