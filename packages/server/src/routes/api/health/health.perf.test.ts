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
let cleanup: () => Promise<void> = async () => {};

beforeEach(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
  });
  app = server.app;
  client = testClient(app);
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

async function requestHealth() {
  const response = await client.api.health.$get();
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toMatchObject({
      status: 'ok',
      uptime: expect.any(Number),
      checks: {
        database: 'ok',
      },
    });
  });
}

async function requestLive() {
  const response = await client.api.health.live.$get();
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toEqual({
      status: 'ok',
    });
  });
}

async function requestReady() {
  const response = await client.api.health.ready.$get();
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toEqual({
      status: 'ok',
      checks: {
        database: 'ok',
      },
    });
  });
}

describe('health API perf', () => {
  test('GET /api/health handles repeated health checks through the real route', async () => {
    await runHttpPerf({
      name: 'GET /api/health smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestHealth,
    });
  });

  test('GET /api/health/live handles repeated liveness checks through the real route', async () => {
    await runHttpPerf({
      name: 'GET /api/health/live smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestLive,
    });
  });

  test('GET /api/health/ready handles repeated readiness checks through the real route', async () => {
    await runHttpPerf({
      name: 'GET /api/health/ready smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestReady,
    });
  });
});
