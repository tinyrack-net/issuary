import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  createDbUserWithSession,
  createTestApp,
  createTestEmailConfig,
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
  const email = await createTestEmailConfig();
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    email,
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function requestForgot(email: string) {
  const response = await app.request('/api/auth/password/forgot', {
    method: 'POST',
    headers: {
      'accept-language': 'en',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  const body: { ok?: boolean } = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.ok).toBe(true);

  return response;
}

async function createPasswordResetFixture(index: number) {
  const email = generateUniqueEmail(`password-reset-perf-${index}`);
  const oldPassword = 'OldPassword123!';
  const newPassword = 'NewPassword123!';
  const { userSub } = await createDbUserWithSession(
    app,
    services,
    email,
    oldPassword,
  );
  const token = await withMikroContext(services, async () => {
    const reset = await services.passwordResetService.generateToken({
      userSub,
      expiresInHours: 1,
    });
    await services.mikro.em.flush();
    return reset.token;
  });

  return { token, newPassword };
}

async function requestReset(token: string, password: string) {
  const response = await app.request('/api/auth/password/reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const body: { message?: string } = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.message).toContain('Password has been reset');

  return response;
}

describe('POST /api/auth/password/forgot perf', () => {
  test('handles repeated password-reset requests through the real route', async () => {
    const email = generateUniqueEmail('password-forgot-perf');
    await createDbUserWithSession(app, services, email, 'Password123!');

    const result = await runHttpPerf({
      name: 'POST /api/auth/password/forgot smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => requestForgot(email),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(3000);
  });
});

describe('POST /api/auth/password/reset perf', () => {
  test('handles pre-created reset tokens through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createPasswordResetFixture(index),
      ),
    );
    let nextFixture = 0;

    const result = await runHttpPerf({
      name: 'POST /api/auth/password/reset smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const fixture = fixtures[nextFixture];
        nextFixture += 1;
        if (!fixture) {
          throw new Error('Missing password reset fixture');
        }
        return requestReset(fixture.token, fixture.newPassword);
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
