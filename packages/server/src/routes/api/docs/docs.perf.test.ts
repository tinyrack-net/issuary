import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  assertJsonBody,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let openApiJsonClient: ReturnType<typeof createOpenApiJsonClient>;
let cleanup: () => Promise<void> = async () => {};

function createOpenApiJsonClient(targetApp: AppType) {
  const openApiJsonApp = new Hono().get('/api/docs/json', (c) =>
    targetApp.fetch(c.req.raw),
  );
  return testClient(openApiJsonApp);
}

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
  });
  app = server.app;
  client = testClient(app);
  openApiJsonClient = createOpenApiJsonClient(app);
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function requestDocs() {
  const response = await client.api.docs.$get();
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/html');
  expect(body).toContain('TinyAuth API');

  return response;
}

async function requestOpenApiJson() {
  const response = await openApiJsonClient.api.docs.json.$get();
  const payloadResponse = response.clone();
  const body = await assertJsonBody(response);
  const payload = await payloadResponse.text();

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
