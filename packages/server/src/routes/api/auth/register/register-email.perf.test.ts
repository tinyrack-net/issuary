import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  createTestApp,
  createTestEmailConfig,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_TERMS_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../../test-utils/index.js';
import { runHttpPerf } from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 3;
const MEASURED_REQUESTS = 30;
const VALID_PASSWORD = 'Password12345!';
const REQUIRED_CONSENTS = [
  { termsId: 'tos', agreed: true },
  { termsId: 'privacy', agreed: true },
];

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const mail = await createTestEmailConfig();
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    email: mail,
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
    users: [TEST_USER_CONFIG],
    terms: TEST_TERMS_CONFIG,
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function createUnverifiedUser(prefix: string) {
  const email = generateUniqueEmail(prefix);
  const passwordHash =
    await services.securityService.hashPassword(VALID_PASSWORD);
  let token = '';

  await withMikroContext(services, async () => {
    const user = services.mikro.user.create({
      email,
      password_hash: passwordHash,
    });
    user.email_verified = false;
    await services.mikro.em.persist(user).flush();
    const verification = await services.emailService.generateToken({
      userSub: user.sub,
    });
    await services.mikro.em.flush();
    token = verification.token;
  });

  return { email, token };
}

async function requestRegister(email: string) {
  const response = await app.request('/api/auth/register', {
    method: 'POST',
    headers: {
      'accept-language': 'en',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: VALID_PASSWORD,
      consents: REQUIRED_CONSENTS,
    }),
  });
  const body: {
    user?: {
      email?: string;
      email_verified?: boolean;
      email_verification_required?: boolean;
    };
  } = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.user?.email).toBe(email);
  expect(body.user?.email_verified).toBe(false);
  expect(body.user?.email_verification_required).toBe(true);
  expect(response.headers.get('set-cookie')).toBeNull();

  return response;
}

async function requestEmailVerify(token: string) {
  const response = await app.request('/api/auth/email/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const body: { user?: { email_verified?: boolean } } = await response
    .clone()
    .json();

  expect(response.status).toBe(200);
  expect(body.user?.email_verified).toBe(true);
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestEmailResend(email: string) {
  const response = await app.request('/api/auth/email/resend', {
    method: 'POST',
    headers: {
      'accept-language': 'en',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  const body: { message?: string } = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.message).toContain('Verification email has been resent');

  return response;
}

describe('POST /api/auth/register perf', () => {
  test('handles unique user registration through the real route', async () => {
    let nextEmail = 0;

    const result = await runHttpPerf({
      name: 'POST /api/auth/register smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async () => {
        nextEmail += 1;
        return requestRegister(
          generateUniqueEmail(`register-perf-${nextEmail}`),
        );
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

describe('POST /api/auth/email/verify perf', () => {
  test('handles pre-created verification tokens through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, () =>
        createUnverifiedUser('email-verify-perf'),
      ),
    );
    let nextFixture = 0;

    const result = await runHttpPerf({
      name: 'POST /api/auth/email/verify smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async () => {
        const fixture = fixtures[nextFixture];
        nextFixture += 1;
        if (fixture === undefined) {
          throw new Error('Missing email verification fixture');
        }
        return requestEmailVerify(fixture.token);
      },
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });
});

describe('POST /api/auth/email/resend perf', () => {
  test('handles repeated resend requests for an unverified user through the real route', async () => {
    const fixture = await createUnverifiedUser('email-resend-perf');

    const result = await runHttpPerf({
      name: 'POST /api/auth/email/resend smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async () => requestEmailResend(fixture.email),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });
});
