import { describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import {
  generateUniqueEmail,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

const app = setupTestServer();

describe('POST /api/v1/auth/password/forgot', () => {
  test(
    'should send password reset email for valid user',
    { timeout: 10000 },
    async () => {
      // 1. Register a new user
      const uniqueEmail = generateUniqueEmail('forgot');
      await app.inject({
        method: 'post',
        url: '/api/v1/auth/register',
        payload: {
          email: uniqueEmail,
          password: 'password123',
        },
      });

      // 2. Request password reset
      const res = await app.inject({
        method: 'post',
        url: '/api/v1/auth/password/forgot',
        payload: {
          email: uniqueEmail,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('message');

      // 3. Check that a reset token was generated
      const token = await withMikroContext(app, async () => {
        const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
        const reset = await app.mikro.passwordReset.findOne({
          user,
          used: false,
          expiresAt: { $gt: new Date() },
        });
        return reset?.token;
      });

      expect(token).toBeDefined();
    },
  );

  test('should return success for non-existent email (prevent enumeration)', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/forgot',
      payload: {
        email: 'nonexistent-user@example.com',
      },
    });

    // Should still return 200 to prevent email enumeration
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });

  test(
    'should fail for config user (not editable)',
    { timeout: 10000 },
    async () => {
      // Use the config user email from config.test.yaml
      const res = await app.inject({
        method: 'post',
        url: '/api/v1/auth/password/forgot',
        payload: {
          email: 'test-config-user@example.com',
        },
      });

      expect(res.statusCode).toBe(e.UserNotEditable.Status);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('code', 'USER_NOT_EDITABLE');
    },
  );

  test(
    'should invalidate previous reset tokens when new one is generated',
    { timeout: 20000 },
    async () => {
      // 1. Register a new user
      const uniqueEmail = generateUniqueEmail('invalidate');
      await app.inject({
        method: 'post',
        url: '/api/v1/auth/register',
        payload: {
          email: uniqueEmail,
          password: 'password123',
        },
      });

      // 2. Request first password reset
      await app.inject({
        method: 'post',
        url: '/api/v1/auth/password/forgot',
        payload: {
          email: uniqueEmail,
        },
      });

      // 3. Get first token
      const firstToken = await withMikroContext(app, async () => {
        const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
        const reset = await app.mikro.passwordReset.findOneOrFail({
          user,
          used: false,
        });
        return reset.token;
      });

      // 4. Request second password reset
      await app.inject({
        method: 'post',
        url: '/api/v1/auth/password/forgot',
        payload: {
          email: uniqueEmail,
        },
      });

      // 5. Check that first token is now expired
      const isFirstTokenValid = await withMikroContext(app, async () => {
        const reset = await app.mikro.passwordReset.findOne({
          token: firstToken,
          used: false,
          expiresAt: { $gt: new Date() },
        });
        return reset !== null;
      });

      expect(isFirstTokenValid).toBe(false);

      // 6. Check that a new valid token exists
      const hasNewToken = await withMikroContext(app, async () => {
        const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
        const reset = await app.mikro.passwordReset.findOne({
          user,
          used: false,
          expiresAt: { $gt: new Date() },
        });
        return reset !== null && reset.token !== firstToken;
      });

      expect(hasNewToken).toBe(true);
    },
  );
});

describe('POST /api/v1/auth/password/reset', () => {
  test(
    'should reset password with valid token',
    { timeout: 10000 },
    async () => {
      // 1. Register a new user
      const uniqueEmail = generateUniqueEmail('reset');
      await app.inject({
        method: 'post',
        url: '/api/v1/auth/register',
        payload: {
          email: uniqueEmail,
          password: 'oldpassword123',
        },
      });

      // 2. Request password reset
      await app.inject({
        method: 'post',
        url: '/api/v1/auth/password/forgot',
        payload: {
          email: uniqueEmail,
        },
      });

      // 3. Get the reset token
      const token = await withMikroContext(app, async () => {
        const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
        const reset = await app.mikro.passwordReset.findOneOrFail({
          user,
          used: false,
        });
        return reset.token;
      });

      // 4. Reset password
      const res = await app.inject({
        method: 'post',
        url: '/api/v1/auth/password/reset',
        payload: {
          token,
          password: 'newpassword456',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('message');

      // 5. Verify old password no longer works
      const oldLoginRes = await app.inject({
        method: 'post',
        url: '/api/v1/auth/login',
        payload: {
          email: uniqueEmail,
          password: 'oldpassword123',
        },
      });
      expect(oldLoginRes.statusCode).toBe(401);

      // 6. Verify new password works
      const newLoginRes = await app.inject({
        method: 'post',
        url: '/api/v1/auth/login',
        payload: {
          email: uniqueEmail,
          password: 'newpassword456',
        },
      });
      expect(newLoginRes.statusCode).toBe(200);
    },
  );

  test('should fail with invalid token', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/reset',
      payload: {
        token: 'invalid-token-12345',
        password: 'newpassword456',
      },
    });

    expect(res.statusCode).toBe(e.InvalidPasswordResetToken.Status);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', 'INVALID_PASSWORD_RESET_TOKEN');
  });

  test('should fail with expired token', { timeout: 10000 }, async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('expired-reset');
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    // 2. Request password reset
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/forgot',
      payload: {
        email: uniqueEmail,
      },
    });

    // 3. Manually expire the token
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      const reset = await app.mikro.passwordReset.findOneOrFail({
        user,
        used: false,
      });
      reset.expiresAt = new Date(Date.now() - 1000);
      await app.mikro.em.flush();
    });

    // 4. Get the expired token
    const token = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      const reset = await app.mikro.passwordReset.findOneOrFail({ user });
      return reset.token;
    });

    // 5. Try to reset with expired token
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/reset',
      payload: {
        token,
        password: 'newpassword456',
      },
    });

    expect(res.statusCode).toBe(e.InvalidPasswordResetToken.Status);
  });

  test('should fail with already used token', { timeout: 10000 }, async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('used-reset');
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    // 2. Request password reset
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/forgot',
      payload: {
        email: uniqueEmail,
      },
    });

    // 3. Get the token
    const token = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      const reset = await app.mikro.passwordReset.findOneOrFail({
        user,
        used: false,
      });
      return reset.token;
    });

    // 4. First reset - should succeed
    const firstRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/reset',
      payload: {
        token,
        password: 'newpassword456',
      },
    });
    expect(firstRes.statusCode).toBe(200);

    // 5. Second reset with same token - should fail
    const secondRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/reset',
      payload: {
        token,
        password: 'anotherpassword789',
      },
    });

    expect(secondRes.statusCode).toBe(e.InvalidPasswordResetToken.Status);
  });
});
