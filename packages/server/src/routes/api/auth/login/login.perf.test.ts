import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from '../../../../test-utils/index.js';
import { runHttpPerf } from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 5;
const MEASURED_REQUESTS = 50;
const DB_LOGIN_WARMUP_REQUESTS = 1;
const DB_LOGIN_MEASURED_REQUESTS = 10;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
  });
  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function requestLogin() {
  const response = await client.api.auth.login.$post({
    json: {
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
  });
  const body = await assertJsonBody(response);

  expect(body.user?.sub).toBe(TEST_USER_CONFIG.sub);
  expect(body.user?.managed_by).toBe('config');
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestDatabaseLogin(email: string, password: string) {
  const response = await client.api.auth.login.$post({
    json: { email, password },
  });
  const body = await assertJsonBody(response);

  expect(body.user?.sub).toEqual(expect.any(String));
  expect(body.user?.managed_by).toBe('database');
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestLogout(sessionCookie: string) {
  const response = await client.api.auth.logout.$post(
    {},
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.ok).toBe(true);
  expect(response.headers.get('set-cookie')).toContain('session=');

  return response;
}

describe('POST /api/auth/login perf', () => {
  test('handles repeated config-user logins through the real route', async () => {
    const result = await runHttpPerf({
      name: 'POST /api/auth/login config-user smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      request: requestLogin,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });

  test('handles repeated database-user password logins through the real route', async () => {
    const email = generateUniqueEmail('login-db-perf');
    const password = 'Password123!';
    await createDbUserWithSession(app, services, email, password);

    const result = await runHttpPerf({
      name: 'POST /api/auth/login database-user PBKDF2 smoke',
      warmupRequests: DB_LOGIN_WARMUP_REQUESTS,
      requests: DB_LOGIN_MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => requestDatabaseLogin(email, password),
    });

    expect(result.totalRequests).toBe(DB_LOGIN_MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(DB_LOGIN_MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(5000);
  });
});

describe('POST /api/auth/logout perf', () => {
  test('handles repeated idempotent logout requests through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const result = await runHttpPerf({
      name: 'POST /api/auth/logout idempotent smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      request: async () => requestLogout(sessionCookie),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(10);
    expect(result.p95Ms).toBeLessThan(500);
  });

  test('handles pre-created authenticated logout sessions through the real route', async () => {
    const sessionCookies = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, async () =>
        createAuthenticatedSession(app),
      ),
    );
    let nextSession = 0;

    const result = await runHttpPerf({
      name: 'POST /api/auth/logout authenticated sessions smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      request: async () => {
        const sessionCookie = sessionCookies[nextSession];
        nextSession += 1;
        if (!sessionCookie) {
          throw new Error('Missing logout session');
        }
        return requestLogout(sessionCookie);
      },
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
