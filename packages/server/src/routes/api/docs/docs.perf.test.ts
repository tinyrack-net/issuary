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

async function requestOpenApiJson() {
  const response = await app.request('/api/docs/json');
  const body = await response.clone().json();
  const payload = await response.clone().text();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(body).toEqual(
    expect.objectContaining({
      openapi: expect.any(String),
      info: expect.objectContaining({
        title: expect.any(String),
      }),
      paths: expect.any(Object),
    }),
  );
  expect(payload.length).toBeGreaterThan(10_000);
  expect(payload.length).toBeLessThan(1_000_000);

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

  test('GET /api/docs/json handles repeated OpenAPI spec requests through the cached route', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/docs/json smoke',
      warmupRequests: 5,
      requests: 100,
      concurrency: 10,
      request: requestOpenApiJson,
    });

    expect(result.totalRequests).toBe(100);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(100);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(10);
    expect(result.p95Ms).toBeLessThan(500);
  });
});
