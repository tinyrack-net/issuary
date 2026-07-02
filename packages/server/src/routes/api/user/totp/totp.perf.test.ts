import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  createDbUserWithSession,
  createTestApp,
  enableTotpForUser,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
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

async function createSession(index: number) {
  return createDbUserWithSession(
    app,
    services,
    generateUniqueEmail(`user-totp-perf-${index}`),
    'Password123!',
  );
}

async function createVerifyFixture(index: number) {
  const { sessionCookie } = await createSession(index);
  const setupResponse = await app.request('/api/user/totp/setup', {
    method: 'POST',
    headers: { Cookie: `session=${sessionCookie}` },
  });
  expect(setupResponse.status).toBe(200);
  const setupBody: { secret?: string } = await setupResponse.json();
  if (!setupBody.secret) {
    throw new Error('Missing TOTP setup secret');
  }

  return {
    sessionCookie,
    code: services.totpService.generateToken(setupBody.secret),
  };
}

async function createConfirmFixture(index: number) {
  const fixture = await createVerifyFixture(index);
  const verifyResponse = await app.request('/api/user/totp/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Cookie: `session=${fixture.sessionCookie}`,
    },
    body: JSON.stringify({ code: fixture.code }),
  });
  expect(verifyResponse.status).toBe(200);

  return fixture.sessionCookie;
}

async function createRegisteredTotpFixture(index: number) {
  const { sessionCookie, userSub } = await createSession(index);
  const secret = await enableTotpForUser(services, userSub);
  return {
    sessionCookie,
    code: services.totpService.generateToken(secret),
  };
}

async function createDeleteFixture(index: number) {
  return createRegisteredTotpFixture(index);
}

async function requestSetup(sessionCookie: string) {
  const response = await app.request('/api/user/totp/setup', {
    method: 'POST',
    headers: { Cookie: `session=${sessionCookie}` },
  });
  const body: { secret?: string; otpauth_url?: string; qr_code?: string } =
    await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.secret).toEqual(expect.any(String));
  expect(body.otpauth_url).toContain('otpauth://totp/');
  expect(body.qr_code).toMatch(/^data:image\/png;base64,/);

  return response;
}

async function requestVerify(sessionCookie: string, code: string) {
  const response = await app.request('/api/user/totp/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Cookie: `session=${sessionCookie}`,
    },
    body: JSON.stringify({ code }),
  });
  const body: { recovery_codes?: string[] } = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.recovery_codes).toHaveLength(8);

  return response;
}

async function requestConfirm(sessionCookie: string) {
  const response = await app.request('/api/user/totp/confirm', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Cookie: `session=${sessionCookie}`,
    },
    body: JSON.stringify({}),
  });
  const body: { user?: { totp_registered?: boolean } } = await response
    .clone()
    .json();

  expect(response.status).toBe(200);
  expect(body.user?.totp_registered).toBe(true);

  return response;
}

async function requestRegenerate(sessionCookie: string, code: string) {
  const response = await app.request('/api/user/totp/recovery/regenerate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Cookie: `session=${sessionCookie}`,
    },
    body: JSON.stringify({ code }),
  });
  const body: { recovery_codes?: string[] } = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.recovery_codes).toHaveLength(8);

  return response;
}

async function requestDelete(sessionCookie: string, code: string) {
  const response = await app.request('/api/user/totp', {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      Cookie: `session=${sessionCookie}`,
    },
    body: JSON.stringify({ code }),
  });
  const body: { ok?: boolean } = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.ok).toBe(true);

  return response;
}

describe('POST /api/user/totp/setup perf', () => {
  test('handles repeated setup requests through the real route', async () => {
    const { sessionCookie } = await createSession(0);

    const result = await runHttpPerf({
      name: 'POST /api/user/totp/setup smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => requestSetup(sessionCookie),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(4000);
  });
});

describe('POST /api/user/totp/confirm perf', () => {
  test('handles pre-verified setup sessions through the real route', async () => {
    const sessions = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createConfirmFixture(index),
      ),
    );
    let nextSession = 0;

    const result = await runHttpPerf({
      name: 'POST /api/user/totp/confirm smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const sessionCookie = sessions[nextSession];
        nextSession += 1;
        if (!sessionCookie) {
          throw new Error('Missing TOTP confirm session');
        }
        return requestConfirm(sessionCookie);
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

describe('POST /api/user/totp/verify perf', () => {
  test('handles pre-created setup sessions through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createVerifyFixture(index),
      ),
    );
    let nextFixture = 0;

    const result = await runHttpPerf({
      name: 'POST /api/user/totp/verify smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const fixture = fixtures[nextFixture];
        nextFixture += 1;
        if (!fixture) {
          throw new Error('Missing TOTP verify fixture');
        }
        return requestVerify(fixture.sessionCookie, fixture.code);
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

describe('POST /api/user/totp/recovery/regenerate perf', () => {
  test('handles repeated recovery-code regenerations through the real route', async () => {
    const fixture = await createRegisteredTotpFixture(0);

    const result = await runHttpPerf({
      name: 'POST /api/user/totp/recovery/regenerate smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () =>
        requestRegenerate(fixture.sessionCookie, fixture.code),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(4000);
  });
});

describe('DELETE /api/user/totp perf', () => {
  test('handles pre-created TOTP sessions through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createDeleteFixture(index),
      ),
    );
    let nextFixture = 0;

    const result = await runHttpPerf({
      name: 'DELETE /api/user/totp smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const fixture = fixtures[nextFixture];
        nextFixture += 1;
        if (!fixture) {
          throw new Error('Missing TOTP delete fixture');
        }
        return requestDelete(fixture.sessionCookie, fixture.code);
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
