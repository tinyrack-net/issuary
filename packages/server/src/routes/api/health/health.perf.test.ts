import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  assertJsonBody,
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

async function requestHealth() {
  const response = await app.request('/api/health');
  const body = await assertJsonBody(response);

  expect(response.headers.get('content-type')).toContain('application/json');
  expect(body).toMatchObject({
    status: 'ok',
    uptime: expect.any(Number),
    checks: {
      database: 'ok',
    },
  });

  return response;
}

async function requestLive() {
  const response = await app.request('/api/health/live');
  const body = await assertJsonBody(response);

  expect(response.headers.get('content-type')).toContain('application/json');
  expect(body).toEqual({
    status: 'ok',
  });

  return response;
}

async function requestReady() {
  const response = await app.request('/api/health/ready');
  const body = await assertJsonBody(response);

  expect(response.headers.get('content-type')).toContain('application/json');
  expect(body).toEqual({
    status: 'ok',
    checks: {
      database: 'ok',
    },
  });

  return response;
}

describe('health API perf', () => {
  test('GET /api/health handles repeated health checks through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/health smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestHealth,
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('GET /api/health/live handles repeated liveness checks through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/health/live smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestLive,
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('GET /api/health/ready handles repeated readiness checks through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/health/ready smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestReady,
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
