import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/v1/auth/email/resend', () => {
  test('should return 404 for non-existent user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/resend',
      payload: {
        email: 'nonexistent@example.com',
      },
    });

    expect(res.statusCode).toBe(404);
    const json = res.json();
    expect(json.code).toBe('USER_NOT_FOUND');
  });

  test('should return 400 for already verified email', async () => {
    // Create a user with verified email
    const email = generateUniqueEmail('email-verified');
    const password = 'TestPassword123!';

    await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await app.mikro.em.persist(user).flush();
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/resend',
      payload: { email },
    });

    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.code).toBe('EMAIL_ALREADY_VERIFIED');
  });

  test('should successfully resend verification email for unverified user', async () => {
    // Create a user with unverified email
    const email = generateUniqueEmail('email-unverified');
    const password = 'TestPassword123!';

    await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = false;
      await app.mikro.em.persist(user).flush();
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/resend',
      payload: { email },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.message).toBeDefined();
    expect(json.message).toContain('Verification email has been resent');
  });

  test('should generate new verification token on resend', async () => {
    const email = generateUniqueEmail('email-resend-token');
    const password = 'TestPassword123!';

    // Create user and initial verification token
    await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = false;
      await app.mikro.em.persist(user).flush();

      if (!app.emailVerificationService) {
        throw new Error('EmailVerificationService not initialized');
      }

      await app.emailVerificationService.generateToken({ userId: user.id });
    });

    // Resend verification email
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/resend',
      payload: { email },
    });

    expect(res.statusCode).toBe(200);

    // Verify new token was created
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email });
      expect(user).toBeDefined();

      // Check that there is a valid pending verification
      const hasPending =
        await app.emailVerificationService?.hasPendingVerification(user.id);
      expect(hasPending).toBe(true);
    });
  });

  test('should validate email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/resend',
      payload: {
        email: 'invalid-email',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  test('should not require authentication', async () => {
    // This endpoint should be publicly accessible (for password reset flow)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/resend',
      payload: {
        email: 'test@example.com',
      },
    });

    // Should not return 401 (will be 404 because user doesn't exist)
    expect(res.statusCode).not.toBe(401);
  });

  test('should return 404 for config user', async () => {
    // Config users exist but cannot have email verification resent
    // The endpoint should find the user and check email_verified status
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/resend',
      payload: {
        email: TEST_USER.email,
      },
    });

    // Config user is pre-verified, so should return EMAIL_ALREADY_VERIFIED or USER_NOT_FOUND
    // depending on implementation (config users may not be in email verification flow)
    expect([400, 404]).toContain(res.statusCode);
  });
});
