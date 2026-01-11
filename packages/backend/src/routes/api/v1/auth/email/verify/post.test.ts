import { describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import {
  generateUniqueEmail,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

const app = setupTestServer();

describe('POST /api/v1/auth/email/verify', () => {
  test('should verify email with valid token', async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('verify');
    const registerRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(registerRes.statusCode).toBe(200);
    const registerBody = JSON.parse(registerRes.body);
    expect(registerBody.user.email_verified).toBe(false);

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
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
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
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
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

describe('POST /api/v1/auth/email/resend', () => {
  test('should resend verification email', async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('resend');
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    // 2. Get the first token
    const firstToken = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      const firstVerification = await app.mikro.emailVerification.findOneOrFail(
        {
          user,
          verified: false,
        },
      );
      return firstVerification.token;
    });

    // 3. Request resend
    const resendRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/email/resend',
      payload: {
        email: uniqueEmail,
      },
    });

    expect(resendRes.statusCode).toBe(200);
    const body = JSON.parse(resendRes.body);
    expect(body).toHaveProperty('message');

    // 4. Check that a new token was generated
    const newToken = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      const newVerification = await app.mikro.emailVerification.findOne({
        user,
        verified: false,
        expiresAt: { $gt: new Date() },
      });

      expect(newVerification).toBeDefined();
      return newVerification?.token;
    });

    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(firstToken);
  });

  test('should fail to resend for non-existent email', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/email/resend',
      payload: {
        email: 'nonexistent@example.com',
      },
    });

    expect(res.statusCode).toBe(e.UserNotFound.Status);
  });

  test('should fail to resend for already verified email', async () => {
    // 1. Register a user
    const uniqueEmail = generateUniqueEmail('verified');
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    // 2. Get token and verify the email
    const token = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      const verification = await app.mikro.emailVerification.findOneOrFail({
        user,
      });
      return verification.token;
    });

    await app.inject({
      method: 'post',
      url: '/api/v1/auth/email/verify',
      payload: {
        token,
      },
    });

    // 3. Try to resend verification email
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/email/resend',
      payload: {
        email: uniqueEmail,
      },
    });

    expect(res.statusCode).toBe(e.EmailAlreadyVerified.Status);
  });
});
