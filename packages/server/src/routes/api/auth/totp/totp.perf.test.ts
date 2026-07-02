import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  createDbUserWithSession,
  createTestApp,
  enableTotpForUser,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../../../../test-utils/index.js';
import { runHttpPerf } from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 1;
const MEASURED_REQUESTS = 10;

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    auth: {
      password: {
        totp: { enabled: true },
      },
    },
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function createPendingTotpFixture(index: number) {
  const email = generateUniqueEmail(`auth-totp-perf-${index}`);
  const password = 'Password123!';
  const { userSub } = await createDbUserWithSession(
    app,
    services,
    email,
    password,
  );
  const secret = await enableTotpForUser(services, userSub);
  const loginResponse = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(loginResponse.status).toBe(200);

  return {
    sessionCookie: extractCookie(loginResponse, 'session'),
    code: services.totpService.generateToken(secret),
  };
}

async function createPendingRecoveryFixture(index: number) {
  const email = generateUniqueEmail(`auth-totp-recovery-perf-${index}`);
  const password = 'Password123!';
  const { userSub } = await createDbUserWithSession(
    app,
    services,
    email,
    password,
  );
  await enableTotpForUser(services, userSub);
  const recoveryCodes = await withMikroContext(services, async () => {
    const user = await services.mikro.user.findOneOrFail({ sub: userSub });
    return services.totpService.generateRecoveryCodes(user);
  });
  const loginResponse = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(loginResponse.status).toBe(200);
  const code = recoveryCodes[0];
  if (!code) {
    throw new Error('Missing recovery code');
  }

  return {
    sessionCookie: extractCookie(loginResponse, 'session'),
    code,
  };
}

async function requestTotpVerify(sessionCookie: string, code: string) {
  const response = await app.request('/api/auth/totp/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Cookie: `session=${sessionCookie}`,
    },
    body: JSON.stringify({ code }),
  });
  const body: { user?: { totp_registered?: boolean } } = await response
    .clone()
    .json();

  expect(response.status).toBe(200);
  expect(body.user?.totp_registered).toBe(true);
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestRecoveryVerify(sessionCookie: string, code: string) {
  const response = await app.request('/api/auth/totp/recovery/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Cookie: `session=${sessionCookie}`,
    },
    body: JSON.stringify({ code }),
  });
  const body: { user?: { totp_registered?: boolean } } = await response
    .clone()
    .json();

  expect(response.status).toBe(200);
  expect(body.user?.totp_registered).toBe(true);
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

describe('POST /api/auth/totp/verify perf', () => {
  test('handles pre-created pending TOTP sessions through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createPendingTotpFixture(index),
      ),
    );
    let nextFixture = 0;

    const result = await runHttpPerf({
      name: 'POST /api/auth/totp/verify smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const fixture = fixtures[nextFixture];
        nextFixture += 1;
        if (!fixture) {
          throw new Error('Missing auth TOTP fixture');
        }
        return requestTotpVerify(fixture.sessionCookie, fixture.code);
      },
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(3000);
  });
});

describe('POST /api/auth/totp/recovery/verify perf', () => {
  test('handles pre-created pending recovery sessions through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createPendingRecoveryFixture(index),
      ),
    );
    let nextFixture = 0;

    const result = await runHttpPerf({
      name: 'POST /api/auth/totp/recovery/verify smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const fixture = fixtures[nextFixture];
        nextFixture += 1;
        if (!fixture) {
          throw new Error('Missing auth TOTP recovery fixture');
        }
        return requestRecoveryVerify(fixture.sessionCookie, fixture.code);
      },
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(4000);
  });
});
