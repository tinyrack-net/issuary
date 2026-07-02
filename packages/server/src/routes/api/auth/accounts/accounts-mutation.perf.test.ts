import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  assertJsonBody,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../../test-utils/index.js';
import { runHttpPerf } from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 3;
const MEASURED_REQUESTS = 30;
const LARGE_ROSTER_SIZE = 10;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    auth: {
      account_selection: {
        enabled: true,
        mode: 'smart',
        allow_remove_account: true,
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
});

afterAll(async () => {
  await cleanup();
});

async function createPasswordUser(prefix = 'accounts-mutation-perf') {
  const email = generateUniqueEmail(prefix);
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
  const rememberedSubs: string[] = [TEST_USER_CONFIG.sub];

  for (let index = 1; index < rosterSize; index += 1) {
    const user = await createPasswordUser();
    sessionCookie = await loginWithOptionalCookie(
      user.email,
      user.password,
      sessionCookie,
    );
    rememberedSubs.push(user.sub);
  }

  return { sessionCookie, rememberedSubs };
}

async function createTwoAccountSession() {
  const secondUser = await createPasswordUser('accounts-remove-perf');
  const firstCookie = await loginWithOptionalCookie(
    TEST_USER.email,
    TEST_USER.password,
  );
  const sessionCookie = await loginWithOptionalCookie(
    secondUser.email,
    secondUser.password,
    firstCookie,
  );

  return { sessionCookie, secondUser };
}

async function requestSelect(sessionCookie: string, sub: string) {
  const response = await client.api.auth.accounts.select.$post(
    {
      json: { sub },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.ok).toBe(true);
  expect(body.active_sub).toBe(sub);
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestRemove(sessionCookie: string, sub: string) {
  const response = await client.api.auth.accounts.remove.$post(
    {
      json: { sub },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.ok).toBe(true);
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestSelectNotRemembered(sessionCookie: string) {
  const response = await client.api.auth.accounts.select.$post(
    {
      json: { sub: `missing-${crypto.randomUUID()}` },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response, 400);

  expect(body.code).toBe('ACCOUNT_NOT_REMEMBERED');

  return response;
}

async function requestRemoveActiveAccount(sessionCookie: string, sub: string) {
  const response = await client.api.auth.accounts.remove.$post(
    {
      json: { sub },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response, 400);

  expect(body.code).toBe('ACCOUNT_NOT_REMOVABLE');

  return response;
}

describe('POST /api/auth/accounts/select perf', () => {
  test('handles repeated remembered-account selection through the real route', async () => {
    const session = await createRememberedAccountSession(2);

    const result = await runHttpPerf({
      name: 'POST /api/auth/accounts/select smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: async () =>
        requestSelect(session.sessionCookie, TEST_USER_CONFIG.sub),
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('does not grow pathologically when remembered-account roster size increases', async () => {
    const smallRoster = await createRememberedAccountSession(2);
    const largeRoster = await createRememberedAccountSession(LARGE_ROSTER_SIZE);

    const smallResult = await runHttpPerf({
      name: 'POST /api/auth/accounts/select small roster',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async () => {
        const sub = smallRoster.rememberedSubs[0];
        if (sub === undefined) {
          throw new Error('Missing small-roster remembered account');
        }
        return requestSelect(smallRoster.sessionCookie, sub);
      },
    });
    const largeResult = await runHttpPerf({
      name: 'POST /api/auth/accounts/select large roster',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async () => {
        const sub = largeRoster.rememberedSubs[0];
        if (sub === undefined) {
          throw new Error('Missing large-roster remembered account');
        }
        return requestSelect(largeRoster.sessionCookie, sub);
      },
    });

    expect(smallResult.totalRequests).toBe(MEASURED_REQUESTS);
    expect(largeResult.totalRequests).toBe(MEASURED_REQUESTS);
    expect(smallResult.failed).toBe(0);
    expect(largeResult.failed).toBe(0);
    expect(smallResult.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(largeResult.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(smallResult.errorRate).toBe(0);
    expect(largeResult.errorRate).toBe(0);
    expect(largeResult.rps).toBeGreaterThan(3);
    expect(largeResult.p95Ms).toBeLessThan(1500);
    expect(largeResult.p95Ms).toBeLessThan(smallResult.p95Ms * 5 + 100);
  });

  test('handles not-remembered selection failures through the real route', async () => {
    const session = await createRememberedAccountSession(2);

    const result = await runHttpPerf({
      name: 'POST /api/auth/accounts/select not-remembered smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [400],
      request: async () => requestSelectNotRemembered(session.sessionCookie),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[400]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});

describe('POST /api/auth/accounts/remove perf', () => {
  test('handles pre-created remembered-account removal sessions through the real route', async () => {
    const sessions = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, () =>
        createTwoAccountSession(),
      ),
    );
    let nextSession = 0;

    const result = await runHttpPerf({
      name: 'POST /api/auth/accounts/remove smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async () => {
        const session = sessions[nextSession];
        nextSession += 1;
        if (session === undefined) {
          throw new Error('Missing account removal session');
        }
        return requestRemove(session.sessionCookie, TEST_USER_CONFIG.sub);
      },
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });

  test('handles active-account removal failures through the real route', async () => {
    const session = await createTwoAccountSession();

    const result = await runHttpPerf({
      name: 'POST /api/auth/accounts/remove active-account smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [400],
      request: async () =>
        requestRemoveActiveAccount(
          session.sessionCookie,
          session.secondUser.sub,
        ),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[400]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
