import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  assertJsonBody,
  createTestApp,
  createTestEmailConfig,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_TERMS_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  perfFixture,
  perfRequestSequenceIndex,
  runHttpPerf,
} from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 4;
const MEASURED_REQUESTS = 30;
const TOKEN_BACKLOG_SIZE = getPerfInteger('TINYAUTH_PERF_TOKEN_BACKLOG', 100);
const VALID_PASSWORD = 'Password12345!';
const REQUIRED_CONSENTS = [
  { termsId: 'tos', agreed: true },
  { termsId: 'privacy', agreed: true },
];

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeEach(async () => {
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

async function createUnverifiedUser(prefix: string) {
  const email = generateUniqueEmail(prefix);
  const passwordHash =
    await services.securityService.hashPassword(VALID_PASSWORD);
  let token = '';
  let userSub = '';

  await withMikroContext(services, async () => {
    const user = services.mikro.user.create({
      email,
      password_hash: passwordHash,
    });
    user.email_verified = false;
    await services.mikro.em.persist(user).flush();
    userSub = user.sub;
    const verification = await services.emailService.generateToken({
      userSub: user.sub,
    });
    await services.mikro.em.flush();
    token = verification.token;
  });

  return { email, token, userSub };
}

async function seedEmailVerificationTokenBacklog(
  userSub: string,
  count: number,
) {
  await withMikroContext(services, async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    for (let index = 0; index < count; index += 1) {
      const verification = services.mikro.emailVerification.create({
        user: userSub,
        token: `email-verification-backlog-${crypto.randomUUID()}`,
        expiresAt,
      });
      services.mikro.em.persist(verification);
    }

    await services.mikro.em.flush();
  });
}

async function createUnverifiedUserWithBacklog(prefix: string) {
  const fixture = await createUnverifiedUser(prefix);
  await seedEmailVerificationTokenBacklog(fixture.userSub, TOKEN_BACKLOG_SIZE);

  return fixture;
}

async function requestRegister(email: string) {
  const response = await client.api.auth.register.$post({
    header: { 'accept-language': 'en' },
    json: {
      email,
      password: VALID_PASSWORD,
      consents: REQUIRED_CONSENTS,
    },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.user?.email).toBe(email);
    expect(body.user?.email_verified).toBe(false);
    expect(body.user?.email_verification_required).toBe(true);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
}

async function requestEmailVerify(token: string) {
  const response = await client.api.auth.email.verify.$post({
    json: { token },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.user?.email_verified).toBe(true);
    expect(extractCookie(response, 'session')).toEqual(expect.any(String));
  });
}

async function requestEmailResend(email: string) {
  const response = await client.api.auth.email.resend.$post({
    header: { 'accept-language': 'en' },
    json: {
      email,
    },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.message).toContain('Verification email has been resent');
  });
}

describe('POST /api/auth/register perf', () => {
  test('handles unique user registration through the real route', async () => {
    await runHttpPerf({
      name: 'POST /api/auth/register smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async (context) => {
        const sequenceIndex = perfRequestSequenceIndex(
          context,
          WARMUP_REQUESTS,
        );
        return requestRegister(
          generateUniqueEmail(`register-perf-${sequenceIndex}`),
        );
      },
    });
  });
});

describe('POST /api/auth/email/verify perf', () => {
  test('handles pre-created verification tokens through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, () =>
        createUnverifiedUser('email-verify-perf'),
      ),
    );
    await runHttpPerf({
      name: 'POST /api/auth/email/verify smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async (context) => {
        const fixture = perfFixture(fixtures, context, WARMUP_REQUESTS);
        return requestEmailVerify(fixture.token);
      },
    });
  });
});

describe('POST /api/auth/email/resend perf', () => {
  test('handles repeated resend requests for an unverified user through the real route', async () => {
    const fixture = await createUnverifiedUser('email-resend-perf');

    await runHttpPerf({
      name: 'POST /api/auth/email/resend smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async () => requestEmailResend(fixture.email),
    });
  });

  test('handles resend requests with an existing verification token backlog through the real route', async () => {
    const fixture = await createUnverifiedUserWithBacklog(
      'email-resend-backlog-perf',
    );

    await runHttpPerf({
      name: 'POST /api/auth/email/resend token backlog smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 3,
      request: async () => requestEmailResend(fixture.email),
    });
  });
});
