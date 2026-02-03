import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  registerUser,
  TEST_TERMS_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      terms: TEST_TERMS_CONFIG,
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/v1/auth/email/verify', () => {
  test('should verify email with valid token', async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('verify');
    const registerRes = await registerUser(app, {
      email: uniqueEmail,
      password: 'password123',
    });

    expect(registerRes.statusCode).toBe(200);
    const registerBody = JSON.parse(registerRes.body);
    expect(registerBody).toHaveProperty('user');
    expect(registerBody.user.email_verified).toBe(false);
    expect(registerBody.user.email_verification_required).toBe(true);

    // 2. Get the verification token from database
    const token = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      const verification = await app.mikro.emailVerification.findOneOrFail({
        user,
        verified: false,
      });
      return verification.token;
    });

    // 3. Verify email with token
    const verifyRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/email/verify',
      payload: {
        token,
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.body);
    expect(verifyBody).toHaveProperty('user');
    expect(verifyBody.user.email_verified).toBe(true);

    // 4. Check that user's email is marked as verified in database
    const isVerified = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      return user.email_verified;
    });
    expect(isVerified).toBe(true);

    // 5. Check that session was created
    expect(verifyRes.headers['set-cookie']).toBeDefined();
  });

  test('should fail with invalid token', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/email/verify',
      payload: {
        token: 'invalid-token-12345',
      },
    });

    expect(res.statusCode).toBe(e.InvalidVerificationToken.Status);
    const body = JSON.parse(res.body);
    const expectedError = new e.InvalidVerificationToken.Error();
    expect(body).toHaveProperty('code', expectedError.code);
  });

  test('should fail with expired token', async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('expired');
    await registerUser(app, {
      email: uniqueEmail,
      password: 'password123',
    });

    // 2. Get the verification token and expire it
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      const verification = await app.mikro.emailVerification.findOneOrFail({
        user,
        verified: false,
      });

      // Manually expire the token
      verification.expiresAt = new Date(Date.now() - 1000);
      await app.mikro.em.flush();
    });

    // 3. Get the expired token
    const token = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      const verification = await app.mikro.emailVerification.findOneOrFail({
        user,
      });
      return verification.token;
    });

    // 4. Try to verify with expired token
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/email/verify',
      payload: {
        token,
      },
    });

    expect(res.statusCode).toBe(e.InvalidVerificationToken.Status);
  });

  test('should fail with already used token', async () => {
    // 1. Register a user
    const uniqueEmail = generateUniqueEmail('used');
    await registerUser(app, {
      email: uniqueEmail,
      password: 'password123',
    });

    // 2. Get the token
    const token = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      const verification = await app.mikro.emailVerification.findOneOrFail({
        user,
        verified: false,
      });
      return verification.token;
    });

    // 3. First verification - should succeed
    const firstRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/email/verify',
      payload: { token },
    });
    expect(firstRes.statusCode).toBe(200);

    // 4. Second verification with same token - should fail
    const secondRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/email/verify',
      payload: { token },
    });

    expect(secondRes.statusCode).toBe(e.InvalidVerificationToken.Status);
  });
});

// Note: Email resend tests are in the dedicated resend/post.test.ts file
