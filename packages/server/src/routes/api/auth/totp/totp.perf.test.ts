import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createTestApp,
  enableTotpForUser,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  perfFixture,
  runHttpPerf,
} from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 4;
const MEASURED_REQUESTS = 20;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    auth: {
      password: {
        totp: { enabled: true },
      },
    },
  });
  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterEach(async () => {
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
  const loginResponse = await client.api.auth.login.$post({
    json: { email, password },
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
  const loginResponse = await client.api.auth.login.$post({
    json: { email, password },
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
  const response = await client.api.auth.totp.verify.$post(
    { json: { code } },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.user?.totp_registered).toBe(true);
    expect(extractCookie(response, 'session')).toEqual(expect.any(String));
  });
}

async function requestInvalidTotpVerify(sessionCookie: string, code: string) {
  const response = await client.api.auth.totp.verify.$post(
    { json: { code } },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );

  return deferPerfResponseValidation(response, async () => {
    expect(response.status).toBe(400);
  });
}

async function requestRecoveryVerify(sessionCookie: string, code: string) {
  const response = await client.api.auth.totp.recovery.verify.$post(
    { json: { code } },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.user?.totp_registered).toBe(true);
    expect(extractCookie(response, 'session')).toEqual(expect.any(String));
  });
}

describe('POST /api/auth/totp/verify perf', () => {
  test('handles pre-created pending TOTP sessions through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createPendingTotpFixture(index),
      ),
    );
    await runHttpPerf({
      name: 'POST /api/auth/totp/verify smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async (context) => {
        const fixture = perfFixture(fixtures, context, WARMUP_REQUESTS);
        return requestTotpVerify(fixture.sessionCookie, fixture.code);
      },
    });
  });

  test('handles invalid TOTP code failures through the real route', async () => {
    const fixture = await createPendingTotpFixture(1000);
    const invalidCode = fixture.code === '000000' ? '111111' : '000000';

    await runHttpPerf({
      name: 'POST /api/auth/totp/verify invalid-code smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      expectedStatuses: [400],
      request: async () =>
        requestInvalidTotpVerify(fixture.sessionCookie, invalidCode),
    });
  });
});

describe('POST /api/auth/totp/recovery/verify perf', () => {
  test('handles pre-created pending recovery sessions through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createPendingRecoveryFixture(index),
      ),
    );
    await runHttpPerf({
      name: 'POST /api/auth/totp/recovery/verify smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async (context) => {
        const fixture = perfFixture(fixtures, context, WARMUP_REQUESTS);
        return requestRecoveryVerify(fixture.sessionCookie, fixture.code);
      },
    });
  });
});
