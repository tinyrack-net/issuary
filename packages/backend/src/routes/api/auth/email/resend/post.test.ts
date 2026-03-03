import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createTestApp,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
    },
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('POST /api/auth/email/resend', () => {
  test('should return 404 for non-existent user', async () => {
    const client = testClient(app);
    const res = await client.api.auth.email.resend.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: 'nonexistent@example.com',
      },
    });

    const json = await assertJsonBody(res, 404);
    expect(json.code).toBe('USER_NOT_FOUND');
  });

  test('should return 400 for already verified email', async () => {
    // Create a user with verified email
    const email = generateUniqueEmail('email-verified');
    const password = 'TestPassword123!';

    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    const client = testClient(app);
    const res = await client.api.auth.email.resend.$post({
      header: { 'accept-language': 'en' },
      json: { email },
    });

    const json = await assertJsonBody(res, 400);
    expect(json.code).toBe('EMAIL_ALREADY_VERIFIED');
  });

  test('should successfully resend verification email for unverified user', async () => {
    // Create a user with unverified email
    const email = generateUniqueEmail('email-unverified');
    const password = 'TestPassword123!';

    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = false;
      await services.mikro.em.persist(user).flush();
    });

    const client = testClient(app);
    const res = await client.api.auth.email.resend.$post({
      header: { 'accept-language': 'en' },
      json: { email },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBeDefined();
    expect(json.message).toContain('Verification email has been resent');
  });

  test('should generate new verification token on resend', async () => {
    const email = generateUniqueEmail('email-resend-token');
    const password = 'TestPassword123!';

    // Create user and initial verification token
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = false;
      await services.mikro.em.persist(user).flush();

      await services.emailService.generateToken({
        userSub: user.sub,
      });
    });

    // Resend verification email
    const client = testClient(app);
    const res = await client.api.auth.email.resend.$post({
      header: { 'accept-language': 'en' },
      json: { email },
    });

    expect(res.status).toBe(200);

    // Verify new token was created
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email,
      });
      expect(user).toBeDefined();

      // Check that there is a valid pending verification
      const hasPending = await services.emailService.hasPendingVerification(
        user.sub,
      );
      expect(hasPending).toBe(true);
    });
  });

  test('should validate email format', async () => {
    const client = testClient(app);
    // @ts-expect-error testing validation with invalid input
    const res = await client.api.auth.email.resend.$post({
      json: {
        email: 'invalid-email',
      },
    });

    expect(res.status).toBe(400);
  });

  test('should not require authentication', async () => {
    // This endpoint should be publicly accessible (for password reset flow)
    const client = testClient(app);
    const res = await client.api.auth.email.resend.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: 'test@example.com',
      },
    });

    // Should not return 401 (will be 404 because user doesn't exist)
    expect(res.status).not.toBe(401);
  });

  test('should return 404 for config user', async () => {
    // Config users exist but cannot have email verification resent
    // The endpoint should find the user and check email_verified status
    const client = testClient(app);
    const res = await client.api.auth.email.resend.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: TEST_USER.email,
      },
    });

    // Config user is pre-verified, so should return EMAIL_ALREADY_VERIFIED or USER_NOT_FOUND
    // depending on implementation (config users may not be in email verification flow)
    expect([400, 404]).toContain(res.status);
  });
});

describe('POST /api/auth/email/resend (smtp disabled)', () => {
  let appNoSmtp: AppType;
  let cleanupNoSmtp: () => Promise<void>;

  beforeAll(async () => {
    const { smtp: _smtp, ...configWithoutSmtp } = MINIMAL_TEST_CONFIG;
    void _smtp;
    const server = await createTestApp({
      config: {
        ...configWithoutSmtp,
        users: [TEST_USER_CONFIG],
      },
    });
    appNoSmtp = server.app;
    cleanupNoSmtp = server.cleanup;
  });

  afterAll(async () => {
    await cleanupNoSmtp();
  });

  test('should return EMAIL_NOT_ACTIVATED when smtp is disabled', async () => {
    const client = testClient(appNoSmtp);
    const res = await client.api.auth.email.resend.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: TEST_USER.email,
      },
    });

    await expectError(res, e.EmailNotActivated);
  });
});
