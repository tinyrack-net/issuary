import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  createAuthenticatedSession,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 5;
const MEASURED_REQUESTS = 50;

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

async function requestDevicePage() {
  const response = await app.request('/oauth/device?user_code=INVALID-CODE');
  const body = await response.clone().text();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/html');
  expect(body).toContain('Sign in to approve the device.');
  expect(body).toContain('/login?return_to=');

  return response;
}

async function requestInvalidDeviceApproval(sessionCookie: string) {
  const response = await app.request('/oauth/device', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: `session=${sessionCookie}`,
    },
    body: new URLSearchParams({
      user_code: 'INVALID-CODE',
      decision: 'approve',
    }),
  });
  const body = await response.clone().json();

  expect(response.status).toBe(400);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(body).toEqual(
    expect.objectContaining({
      error: 'invalid_grant',
      error_description: expect.any(String),
    }),
  );

  return response;
}

describe('OAuth device verification perf', () => {
  test('GET /oauth/device serves the unauthenticated verification page', async () => {
    const result = await runHttpPerf({
      name: 'GET /oauth/device invalid user-code smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestDevicePage,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('POST /oauth/device rejects an invalid user_code for an authenticated user', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const result = await runHttpPerf({
      name: 'POST /oauth/device invalid user-code smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [400],
      request: async () => requestInvalidDeviceApproval(sessionCookie),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[400]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
