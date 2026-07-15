import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../services/container.js';
import {
  assertJsonBody,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  runHttpPerf,
} from '../../../test-utils/perf/index.js';

const LARGE_ROSTER_SIZE = 10;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void> = async () => {};

async function setupPerfApp(): Promise<void> {
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
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
}

async function resetPerfApp(): Promise<void> {
  await cleanup();
  cleanup = async () => {};
  await setupPerfApp();
}

beforeEach(async () => {
  await setupPerfApp();
});

afterEach(async () => {
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

async function markUsersDeleted(subs: string[]) {
  await withMikroContext(services, async () => {
    for (const sub of subs) {
      const user = await services.mikro.user.findOneOrFail({ sub });
      user.deleted_at = new Date();
    }
    await services.mikro.em.flush();
  });
}

async function requestAccounts(sessionCookie: string, expectedSubs: string[]) {
  const response = await client.api.auth.accounts.$get(
    { query: {} },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.active_sub).toBe(expectedSubs[expectedSubs.length - 1]);
    expect(
      body.accounts.map((account: { sub: string }) => account.sub),
    ).toEqual(expectedSubs);
  });
}

describe('GET /api/auth/accounts perf', () => {
  test('handles repeated authenticated account-list requests through the real route', async () => {
    const { sessionCookie, expectedSubs } =
      await createRememberedAccountSession(1);

    await runHttpPerf({
      name: 'GET /api/auth/accounts authenticated smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: async () => requestAccounts(sessionCookie, expectedSubs),
    });
  });

  test('does not grow pathologically when remembered-account roster size increases', async () => {
    const smallRoster = await createRememberedAccountSession(1);

    const smallResult = await runHttpPerf({
      name: 'GET /api/auth/accounts small roster',
      warmupRequests: 3,
      requests: 30,
      concurrency: 3,
      request: async () =>
        requestAccounts(smallRoster.sessionCookie, smallRoster.expectedSubs),
    });

    await resetPerfApp();
    const largeRoster = await createRememberedAccountSession(LARGE_ROSTER_SIZE);

    const largeResult = await runHttpPerf({
      name: 'GET /api/auth/accounts large roster',
      warmupRequests: 3,
      requests: 30,
      concurrency: 3,
      request: async () =>
        requestAccounts(largeRoster.sessionCookie, largeRoster.expectedSubs),
    });

    expect(largeResult.p95Ms).toBeLessThan(smallResult.p95Ms * 5 + 100);
  });

  test('handles remembered-account rosters with stale database users through the real route', async () => {
    const roster = await createRememberedAccountSession(LARGE_ROSTER_SIZE);
    const staleSubs = roster.expectedSubs
      .slice(1, -1)
      .filter((_, index) => index % 2 === 0);
    const staleSubSet = new Set(staleSubs);
    const expectedSubs = roster.expectedSubs.filter(
      (sub) => !staleSubSet.has(sub),
    );
    await markUsersDeleted(staleSubs);

    await runHttpPerf({
      name: 'GET /api/auth/accounts stale roster smoke',
      warmupRequests: 3,
      requests: 30,
      concurrency: 3,
      request: async () => requestAccounts(roster.sessionCookie, expectedSubs),
    });
  });
});
