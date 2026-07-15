import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

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
import {
  deferPerfResponseValidation,
  perfFixture,
  runHttpPerf,
} from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 10;
const MEASURED_REQUESTS = 50;
const DB_LOGIN_WARMUP_REQUESTS = 4;
const DB_LOGIN_MEASURED_REQUESTS = 20;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
  });
  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

async function requestLogin() {
  const response = await client.api.auth.login.$post({
    json: {
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.user?.sub).toBe(TEST_USER_CONFIG.sub);
    expect(body.user?.managed_by).toBe('config');
    expect(extractCookie(response, 'session')).toEqual(expect.any(String));
  });
}

async function requestDatabaseLogin(email: string, password: string) {
  const response = await client.api.auth.login.$post({
    json: { email, password },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.user?.sub).toEqual(expect.any(String));
    expect(body.user?.managed_by).toBe('database');
    expect(extractCookie(response, 'session')).toEqual(expect.any(String));
  });
}

async function requestLogout(sessionCookie: string) {
  const response = await client.api.auth.logout.$post(
    {},
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.ok).toBe(true);
    expect(response.headers.get('set-cookie')).toContain('session=');
  });
}

describe('POST /api/auth/login perf', () => {
  test('handles repeated config-user logins through the real route', async () => {
    await runHttpPerf({
      name: 'POST /api/auth/login config-user smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      request: requestLogin,
    });
  });

  test('handles repeated database-user password logins through the real route', async () => {
    const email = generateUniqueEmail('login-db-perf');
    const password = 'Password123!';
    await createDbUserWithSession(app, services, email, password);

    await runHttpPerf({
      name: 'POST /api/auth/login database-user PBKDF2 smoke',
      warmupRequests: DB_LOGIN_WARMUP_REQUESTS,
      requests: DB_LOGIN_MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => requestDatabaseLogin(email, password),
    });
  });
});

describe('POST /api/auth/logout perf', () => {
  test('handles repeated idempotent logout requests through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    await runHttpPerf({
      name: 'POST /api/auth/logout idempotent smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      request: async () => requestLogout(sessionCookie),
    });
  });

  test('handles pre-created authenticated logout sessions through the real route', async () => {
    const sessionCookies = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, async () =>
        createAuthenticatedSession(app),
      ),
    );
    await runHttpPerf({
      name: 'POST /api/auth/logout authenticated sessions smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      request: async (context) =>
        requestLogout(perfFixture(sessionCookies, context, WARMUP_REQUESTS)),
    });
  });
});
