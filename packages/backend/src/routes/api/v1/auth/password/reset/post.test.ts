import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
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
      app: {
        ...MINIMAL_TEST_CONFIG.app,
        allowed_signup_emails: ['*'],
      },
      terms: TEST_TERMS_CONFIG,
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/v1/auth/password/reset', () => {
  test('should return 400 for invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/reset',
      payload: {
        token: 'invalid-token',
        password: 'NewPassword123!',
      },
    });

    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
  });

  test('should return 400 for expired token', async () => {
    const email = generateUniqueEmail('password-reset-expired');
    const password = 'TestPassword123!';

    // Register user via HTTP
    const registerRes = await registerUser(app, { email, password });
    expect(registerRes.statusCode).toBe(200);

    // Generate token and then expire it
    const expiredToken = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email });

      // Generate token first
      const resetEntity = await app.passwordResetService.generateToken({
        userId: user.id,
        expiresInHours: 1,
      });

      // Manually set expiration to past
      resetEntity.expiresAt = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      await app.mikro.em.flush();

      return resetEntity.token;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/reset',
      payload: {
        token: expiredToken,
        password: 'NewPassword123!',
      },
    });

    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
  });

  test('should successfully reset password with valid token', async () => {
    const email = generateUniqueEmail('password-reset-valid');
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';

    // Register user via HTTP
    const registerRes = await registerUser(app, {
      email,
      password: oldPassword,
    });
    expect(registerRes.statusCode).toBe(200);

    // Generate valid token
    const validToken = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email });

      const resetEntity = await app.passwordResetService.generateToken({
        userId: user.id,
        expiresInHours: 1,
      });
      await app.mikro.em.flush();

      return resetEntity.token;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/reset',
      payload: {
        token: validToken,
        password: newPassword,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.message).toBeDefined();
    expect(json.message).toContain('Password has been reset');

    // Verify new password works
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: newPassword,
      },
    });

    expect(loginRes.statusCode).toBe(200);

    // Verify old password no longer works
    const oldLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: oldPassword,
      },
    });

    expect(oldLoginRes.statusCode).toBe(401);
  });

  test('should invalidate token after use', async () => {
    const email = generateUniqueEmail('password-reset-reuse');
    const password = 'TestPassword123!';

    // Register user via HTTP
    const registerRes = await registerUser(app, { email, password });
    expect(registerRes.statusCode).toBe(200);

    // Generate valid token
    const validToken = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email });

      const resetEntity = await app.passwordResetService.generateToken({
        userId: user.id,
        expiresInHours: 1,
      });
      await app.mikro.em.flush();

      return resetEntity.token;
    });

    // First reset should succeed
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/reset',
      payload: {
        token: validToken,
        password: 'NewPassword123!',
      },
    });

    expect(res1.statusCode).toBe(200);

    // Second reset with same token should fail
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/reset',
      payload: {
        token: validToken,
        password: 'AnotherPassword123!',
      },
    });

    expect(res2.statusCode).toBe(400);
    const json = res2.json();
    expect(json.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
  });

  test('should return 403 for config-managed user', async () => {
    const email = generateUniqueEmail('password-reset-config-managed');

    // Register user via HTTP
    const registerRes = await registerUser(app, {
      email,
      password: 'TestPassword123!',
    });
    expect(registerRes.statusCode).toBe(200);

    // Make user config-managed and generate token
    const token = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email });
      user.managed_by = 'config';
      await app.mikro.em.flush();

      const resetEntity = await app.passwordResetService.generateToken({
        userId: user.id,
        expiresInHours: 1,
      });
      await app.mikro.em.flush();

      return resetEntity.token;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/reset',
      payload: {
        token,
        password: 'NewPassword123!',
      },
    });

    expect(res.statusCode).toBe(403);
    const json = res.json();
    expect(json.code).toBe('USER_NOT_EDITABLE');
  });

  test('should validate password format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/reset',
      payload: {
        token: 'some-token',
        password: '123', // Too short / invalid
      },
    });

    expect(res.statusCode).toBe(400);
  });

  test('should not require authentication', async () => {
    // This endpoint should be publicly accessible
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/reset',
      payload: {
        token: 'any-token',
        password: 'ValidPassword123!',
      },
    });

    // Should not return 401 (will be 400 for invalid token)
    expect(res.statusCode).not.toBe(401);
  });
});
