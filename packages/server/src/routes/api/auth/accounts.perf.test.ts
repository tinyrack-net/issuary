import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../services/container.js';
import {
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

const LARGE_ROSTER_SIZE = 10;

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void> = async () => {};

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    auth: {
      account_selection: {
        enabled: true,
        mode: 'smart',
        remember_accounts: {
          enabled: true,
          max_accounts: LARGE_ROSTER_SIZE,
        },
      },
    },
    users: [TEST_USER_CONFIG],
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function createPasswordUser() {
  const email = generateUniqueEmail('accounts-perf');
  const password = 'testPassword123';
  let sub = '';

  await withMikroContext(services, async () => {
    const passwordHash = await services.securityService.hashPassword(password);
    const user = services.mikro.user.create({
      email,
      password_hash: passwordHash,
    });
    user.email_verified = true;
    await services.mikro.em.persist(user).flush();
    sub = user.sub;
  });

  return { email, password, sub };
}

async function loginWithOptionalCookie(
  email: string,
  password: string,
  sessionCookie?: string,
): Promise<string> {
  const client = testClient(app);
  const response = await client.api.auth.login.$post(
    { json: { email, password } },
    sessionCookie === undefined
      ? undefined
      : { headers: { Cookie: `session=${sessionCookie}` } },
  );

  expect(response.status).toBe(200);
  return extractCookie(response, 'session');
}

async function createRememberedAccountSession(rosterSize: number) {
  let sessionCookie = await loginWithOptionalCookie(
    TEST_USER.email,
    TEST_USER.password,
  );
  const expectedSubs: string[] = [TEST_USER_CONFIG.sub];

  for (let index = 1; index < rosterSize; index += 1) {
    const user = await createPasswordUser();
    sessionCookie = await loginWithOptionalCookie(
      user.email,
      user.password,
      sessionCookie,
    );
    expectedSubs.push(user.sub);
  }

  return { sessionCookie, expectedSubs };
}

async function requestAccounts(sessionCookie: string, expectedSubs: string[]) {
  const response = await app.request('/api/auth/accounts', {
    headers: { Cookie: `session=${sessionCookie}` },
  });
  const body = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.active_sub).toBe(expectedSubs[expectedSubs.length - 1]);
  expect(body.accounts.map((account: { sub: string }) => account.sub)).toEqual(
    expectedSubs,
  );

  return response;
}

describe('GET /api/auth/accounts perf', () => {
  test('handles repeated authenticated account-list requests through the real route', async () => {
    const { sessionCookie, expectedSubs } =
      await createRememberedAccountSession(1);

    const result = await runHttpPerf({
      name: 'GET /api/auth/accounts authenticated smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: async () => requestAccounts(sessionCookie, expectedSubs),
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('does not grow pathologically when remembered-account roster size increases', async () => {
    const smallRoster = await createRememberedAccountSession(1);
    const largeRoster = await createRememberedAccountSession(LARGE_ROSTER_SIZE);

    const smallResult = await runHttpPerf({
      name: 'GET /api/auth/accounts small roster',
      warmupRequests: 3,
      requests: 30,
      concurrency: 3,
      request: async () =>
        requestAccounts(smallRoster.sessionCookie, smallRoster.expectedSubs),
    });
    const largeResult = await runHttpPerf({
      name: 'GET /api/auth/accounts large roster',
      warmupRequests: 3,
      requests: 30,
      concurrency: 3,
      request: async () =>
        requestAccounts(largeRoster.sessionCookie, largeRoster.expectedSubs),
    });

    expect(smallResult.failed).toBe(0);
    expect(largeResult.failed).toBe(0);
    expect(smallResult.statusCounts[200]).toBe(30);
    expect(largeResult.statusCounts[200]).toBe(30);
    expect(largeResult.rps).toBeGreaterThan(3);
    expect(largeResult.p95Ms).toBeLessThan(1500);
    expect(largeResult.p95Ms).toBeLessThan(smallResult.p95Ms * 3 + 15);
  });
});
