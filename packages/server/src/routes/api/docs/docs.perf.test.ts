import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  assertJsonBody,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  runHttpPerf,
} from '../../../test-utils/perf/index.js';

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

beforeEach(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
  });
  app = server.app;
  client = testClient(app);
  openApiJsonClient = createOpenApiJsonClient(app);
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

async function requestDocs() {
  const response = await client.api.docs.$get();
  return deferPerfResponseValidation(response, async () => {
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('TinyAuth API');
  });
}

async function requestOpenApiJson() {
  const response = await openApiJsonClient.api.docs.json.$get();
  return deferPerfResponseValidation(response, async () => {
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
  });
}

describe('OpenAPI docs perf', () => {
  test('GET /api/docs handles repeated Scalar UI requests through the real route', async () => {
    await runHttpPerf({
      name: 'GET /api/docs smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestDocs,
    });
  });

  test('GET /api/docs/json handles repeated OpenAPI spec requests through the cached route', async () => {
    await runHttpPerf({
      name: 'GET /api/docs/json smoke',
      warmupRequests: 5,
      requests: 100,
      concurrency: 10,
      request: requestOpenApiJson,
    });
  });
});
