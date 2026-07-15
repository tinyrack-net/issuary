import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

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
import {
  deferPerfResponseValidation,
  perfFixture,
  runHttpPerf,
} from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 4;
const MEASURED_REQUESTS = 30;
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
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.ok).toBe(true);
    expect(body.active_sub).toBe(sub);
    expect(extractCookie(response, 'session')).toEqual(expect.any(String));
  });
}

async function requestRemove(sessionCookie: string, sub: string) {
  const response = await client.api.auth.accounts.remove.$post(
    {
      json: { sub },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.ok).toBe(true);
    expect(extractCookie(response, 'session')).toEqual(expect.any(String));
  });
}

async function requestSelectNotRemembered(sessionCookie: string) {
  const response = await client.api.auth.accounts.select.$post(
    {
      json: { sub: `missing-${crypto.randomUUID()}` },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response, 400);
    expect(body.code).toBe('ACCOUNT_NOT_REMEMBERED');
  });
}

async function requestRemoveActiveAccount(sessionCookie: string, sub: string) {
  const response = await client.api.auth.accounts.remove.$post(
    {
      json: { sub },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response, 400);
    expect(body.code).toBe('ACCOUNT_NOT_REMOVABLE');
  });
}

describe('POST /api/auth/accounts/select perf', () => {
  test('handles repeated remembered-account selection through the real route', async () => {
    const session = await createRememberedAccountSession(2);

    await runHttpPerf({
      name: 'POST /api/auth/accounts/select smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: async () =>
        requestSelect(session.sessionCookie, TEST_USER_CONFIG.sub),
    });
  });

  test('does not grow pathologically when remembered-account roster size increases', async () => {
    const smallRoster = await createRememberedAccountSession(2);

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

    await resetPerfApp();
    const largeRoster = await createRememberedAccountSession(LARGE_ROSTER_SIZE);

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

    expect(largeResult.p95Ms).toBeLessThan(smallResult.p95Ms * 5 + 100);
  });

  test('handles not-remembered selection failures through the real route', async () => {
    const session = await createRememberedAccountSession(2);

    await runHttpPerf({
      name: 'POST /api/auth/accounts/select not-remembered smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [400],
      request: async () => requestSelectNotRemembered(session.sessionCookie),
    });
  });
});

describe('POST /api/auth/accounts/remove perf', () => {
  test('handles pre-created remembered-account removal sessions through the real route', async () => {
    const sessions = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, () =>
        createTwoAccountSession(),
      ),
    );
    await runHttpPerf({
      name: 'POST /api/auth/accounts/remove smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async (context) => {
        const session = perfFixture(sessions, context, WARMUP_REQUESTS);
        return requestRemove(session.sessionCookie, TEST_USER_CONFIG.sub);
      },
    });
  });

  test('handles active-account removal failures through the real route', async () => {
    const session = await createTwoAccountSession();

    await runHttpPerf({
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
  });
});
