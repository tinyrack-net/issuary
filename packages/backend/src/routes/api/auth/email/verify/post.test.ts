import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createTestApp,
  createTestEmailConfig,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  registerUser,
  TEST_TERMS_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;
const REGISTERED_USER_PASSWORD = 'password123!';

beforeAll(async () => {
  const mail = await createTestEmailConfig();
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    email: mail,
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
    terms: TEST_TERMS_CONFIG,
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('POST /api/auth/email/verify', () => {
  test('should verify email with valid token', async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('verify');
    const registerRes = await registerUser(app, {
      email: uniqueEmail,
      password: REGISTERED_USER_PASSWORD,
    });

    expect(registerRes.status).toBe(200);
    const registerBody = await registerRes.json();
    expect(registerBody).toHaveProperty('user');
    expect(registerBody.user.email_verified).toBe(false);
    expect(registerBody.user.email_verification_required).toBe(true);

    // 2. Get the verification token from database
    const token = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      const verification = await services.mikro.emailVerification.findOneOrFail(
        {
          user,
          verified: false,
        },
      );
      return verification.token;
    });

    // 3. Verify email with token
    const client = testClient(app);
    const verifyRes = await client.api.auth.email.verify.$post({
      json: {
        token,
      },
    });

    const verifyBody = await assertJsonBody(verifyRes);
    expect(verifyBody).toHaveProperty('user');
    expect(verifyBody.user.email_verified).toBe(true);

    // 4. Check that user's email is marked as verified in database
    const isVerified = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      return user.email_verified;
    });
    expect(isVerified).toBe(true);

    // 5. Check that session was created
    expect(verifyRes.headers.get('set-cookie')).toBeDefined();
  });

  test('should fail with invalid token', async () => {
    const client = testClient(app);
    const res = await client.api.auth.email.verify.$post({
      json: {
        token: 'invalid-token-12345',
      },
    });

    expect(res.status).toBe(e.InvalidVerificationToken.Status);
    const body = await res.json();
    const expectedError = new e.InvalidVerificationToken.Error();
    expect(body).toHaveProperty('code', expectedError.code);
  });

  test('should fail with expired token', async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('expired');
    await registerUser(app, {
      email: uniqueEmail,
      password: REGISTERED_USER_PASSWORD,
    });

    // 2. Get the verification token and expire it
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      const verification = await services.mikro.emailVerification.findOneOrFail(
        {
          user,
          verified: false,
        },
      );

      // Manually expire the token
      verification.expiresAt = new Date(Date.now() - 1000);
      await services.mikro.em.flush();
    });

    // 3. Get the expired token
    const token = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      const verification = await services.mikro.emailVerification.findOneOrFail(
        {
          user,
        },
      );
      return verification.token;
    });

    // 4. Try to verify with expired token
    const client = testClient(app);
    const res = await client.api.auth.email.verify.$post({
      json: {
        token,
      },
    });

    expect(res.status).toBe(e.InvalidVerificationToken.Status);
  });

  test('should fail with already used token', async () => {
    // 1. Register a user
    const uniqueEmail = generateUniqueEmail('used');
    await registerUser(app, {
      email: uniqueEmail,
      password: REGISTERED_USER_PASSWORD,
    });

    // 2. Get the token
    const token = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      const verification = await services.mikro.emailVerification.findOneOrFail(
        {
          user,
          verified: false,
        },
      );
      return verification.token;
    });

    // 3. First verification - should succeed
    const client = testClient(app);
    const firstRes = await client.api.auth.email.verify.$post({
      json: { token },
    });
    expect(firstRes.status).toBe(200);

    // 4. Second verification with same token - should fail
    const secondRes = await client.api.auth.email.verify.$post({
      json: { token },
    });

    expect(secondRes.status).toBe(e.InvalidVerificationToken.Status);
  });
});

// Note: Email resend tests are in the dedicated resend/post.test.ts file

describe('POST /api/auth/email/verify (smtp disabled)', () => {
  let appNoSmtp: AppType;
  let cleanupNoSmtp: () => Promise<void>;

  beforeAll(async () => {
    const configWithoutSmtp = MINIMAL_TEST_CONFIG;
    const server = await createTestApp({
      ...configWithoutSmtp,
    });
    appNoSmtp = server.app;
    cleanupNoSmtp = server.cleanup;
  });

  afterAll(async () => {
    await cleanupNoSmtp();
  });

  test('should return EMAIL_NOT_ACTIVATED when smtp is disabled', async () => {
    const client = testClient(appNoSmtp);
    const res = await client.api.auth.email.verify.$post({
      json: {
        token: 'dummy-token',
      },
    });

    await expectError(res, e.EmailNotActivated);
  });
});
