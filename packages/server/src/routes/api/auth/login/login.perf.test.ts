import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import {
  createAuthenticatedSession,
  createTestApp,
  extractCookie,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
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

async function requestLogin() {
  const response = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
  });
  const body: { user?: { sub?: string; managed_by?: string } } = await response
    .clone()
    .json();

  expect(response.status).toBe(200);
  expect(body.user?.sub).toBe(TEST_USER_CONFIG.sub);
  expect(body.user?.managed_by).toBe('config');
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestLogout(sessionCookie: string) {
  const response = await app.request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: `session=${sessionCookie}` },
  });
  const body: { ok?: boolean } = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(response.headers.get('set-cookie')).toContain('session=');

  return response;
}

describe('POST /api/auth/login perf', () => {
  test('handles repeated config-user logins through the real route', async () => {
    const result = await runHttpPerf({
      name: 'POST /api/auth/login config-user smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestLogin,
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });
});

describe('POST /api/auth/logout perf', () => {
  test('handles repeated idempotent logout requests through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const result = await runHttpPerf({
      name: 'POST /api/auth/logout idempotent smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: async () => requestLogout(sessionCookie),
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(10);
    expect(result.p95Ms).toBeLessThan(500);
  });
});
