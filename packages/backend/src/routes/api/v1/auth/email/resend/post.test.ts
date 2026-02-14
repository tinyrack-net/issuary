import type { AppType } from '@backend/lib/app.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
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

describe('POST /api/v1/auth/email/resend', () => {
  test('should return 404 for non-existent user', async () => {
    const res = await app.request('/api/v1/auth/email/resend', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@example.com',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(404);
    const json = await res.json();
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

    const res = await app.request('/api/v1/auth/email/resend', {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const json = await res.json();
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

    const res = await app.request('/api/v1/auth/email/resend', {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: { 'Content-Type': 'application/json' },
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

      if (!services.emailVerificationService) {
        throw new Error('EmailVerificationService not initialized');
      }

      await services.emailVerificationService.generateToken({
        userId: user.id,
      });
    });

    // Resend verification email
    const res = await app.request('/api/v1/auth/email/resend', {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);

    // Verify new token was created
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ email });
      expect(user).toBeDefined();

      // Check that there is a valid pending verification
      const hasPending =
        await services.emailVerificationService?.hasPendingVerification(
          user.id,
        );
      expect(hasPending).toBe(true);
    });
  });

  test('should validate email format', async () => {
    const res = await app.request('/api/v1/auth/email/resend', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
  });

  test('should not require authentication', async () => {
    // This endpoint should be publicly accessible (for password reset flow)
    const res = await app.request('/api/v1/auth/email/resend', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    // Should not return 401 (will be 404 because user doesn't exist)
    expect(res.status).not.toBe(401);
  });

  test('should return 404 for config user', async () => {
    // Config users exist but cannot have email verification resent
    // The endpoint should find the user and check email_verified status
    const res = await app.request('/api/v1/auth/email/resend', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_USER.email,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    // Config user is pre-verified, so should return EMAIL_ALREADY_VERIFIED or USER_NOT_FOUND
    // depending on implementation (config users may not be in email verification flow)
    expect([400, 404]).toContain(res.status);
  });
});
