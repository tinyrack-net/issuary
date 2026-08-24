import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createTestApp,
  createTestEmailConfig,
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
const TOKEN_BACKLOG_SIZE = getPerfInteger('ISSUARY_PERF_TOKEN_BACKLOG', 100);
const PBKDF2_CONCURRENCY = 5;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeEach(async () => {
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
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

function getPerfInteger(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

async function requestForgot(email: string) {
  const response = await client.api.auth.password.forgot.$post({
    header: { 'accept-language': 'en' },
    json: { email },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.ok).toBe(true);
  });
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

async function seedPasswordResetTokenBacklog(userSub: string, count: number) {
  await withMikroContext(services, async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    for (let index = 0; index < count; index += 1) {
      const reset = services.mikro.passwordReset.create({
        user: userSub,
        token: `password-reset-backlog-${crypto.randomUUID()}`,
        expiresAt,
      });
      services.mikro.em.persist(reset);
    }

    await services.mikro.em.flush();
  });
}

async function createPasswordResetBacklogEmail(prefix: string) {
  const email = generateUniqueEmail(prefix);
  const { userSub } = await createDbUserWithSession(
    app,
    services,
    email,
    'Password123!',
  );
  await seedPasswordResetTokenBacklog(userSub, TOKEN_BACKLOG_SIZE);

  return email;
}

async function requestReset(token: string, password: string) {
  const response = await client.api.auth.password.reset.$post({
    json: { token, password },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.message).toContain('Password has been reset');
  });
}

describe('POST /api/auth/password/forgot perf', () => {
  test('handles repeated password-reset requests through the real route', async () => {
    const email = generateUniqueEmail('password-forgot-perf');
    await createDbUserWithSession(app, services, email, 'Password123!');

    await runHttpPerf({
      name: 'POST /api/auth/password/forgot smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => requestForgot(email),
    });
  });

  test('handles password-reset requests with an existing token backlog through the real route', async () => {
    const email = await createPasswordResetBacklogEmail(
      'password-forgot-backlog-perf',
    );

    await runHttpPerf({
      name: 'POST /api/auth/password/forgot token backlog smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => requestForgot(email),
    });
  });
});

describe('POST /api/auth/password/reset perf', () => {
  test('handles pre-created reset tokens through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createPasswordResetFixture(index),
      ),
    );
    await runHttpPerf({
      name: 'POST /api/auth/password/reset smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async (context) => {
        const fixture = perfFixture(fixtures, context, WARMUP_REQUESTS);
        return requestReset(fixture.token, fixture.newPassword);
      },
    });
  });

  test('handles concurrent PBKDF2 password resets through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createPasswordResetFixture(index + 1000),
      ),
    );
    await runHttpPerf({
      name: 'POST /api/auth/password/reset PBKDF2 concurrency smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: PBKDF2_CONCURRENCY,
      request: async (context) => {
        const fixture = perfFixture(fixtures, context, WARMUP_REQUESTS);
        return requestReset(fixture.token, fixture.newPassword);
      },
    });
  });
});
