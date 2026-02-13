import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '@/lib/app.js';
import { createServer } from '@/server.js';
import type { ServiceContainer } from '@/services/container.js';
import {
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  registerUser,
  TEST_TERMS_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      app: {
        ...MINIMAL_TEST_CONFIG.app,
        allowed_signup_emails: ['*'],
      },
      terms: TEST_TERMS_CONFIG,
    },
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('POST /api/v1/auth/password/reset', () => {
  test('should return 400 for invalid token', async () => {
    const res = await app.request('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({
        token: 'invalid-token',
        password: 'NewPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
  });

  test('should return 400 for expired token', async () => {
    const email = generateUniqueEmail('password-reset-expired');
    const password = 'TestPassword123!';

    // Register user via HTTP
    const registerRes = await registerUser(app, { email, password });
    expect(registerRes.status).toBe(200);

    // Generate token and then expire it
    const expiredToken = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ email });

      // Generate token first
      const resetEntity = await services.passwordResetService.generateToken({
        userId: user.id,
        expiresInHours: 1,
      });

      // Manually set expiration to past
      resetEntity.expiresAt = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      await services.mikro.em.flush();

      return resetEntity.token;
    });

    const res = await app.request('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({
        token: expiredToken,
        password: 'NewPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const json = await res.json();
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
    expect(registerRes.status).toBe(200);

    // Generate valid token
    const validToken = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ email });

      const resetEntity = await services.passwordResetService.generateToken({
        userId: user.id,
        expiresInHours: 1,
      });
      await services.mikro.em.flush();

      return resetEntity.token;
    });

    const res = await app.request('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({
        token: validToken,
        password: newPassword,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBeDefined();
    expect(json.message).toContain('Password has been reset');

    // Verify new password works
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: newPassword,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(loginRes.status).toBe(200);

    // Verify old password no longer works
    const oldLoginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: oldPassword,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(oldLoginRes.status).toBe(401);
  });

  test('should invalidate token after use', async () => {
    const email = generateUniqueEmail('password-reset-reuse');
    const password = 'TestPassword123!';

    // Register user via HTTP
    const registerRes = await registerUser(app, { email, password });
    expect(registerRes.status).toBe(200);

    // Generate valid token
    const validToken = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ email });

      const resetEntity = await services.passwordResetService.generateToken({
        userId: user.id,
        expiresInHours: 1,
      });
      await services.mikro.em.flush();

      return resetEntity.token;
    });

    // First reset should succeed
    const res1 = await app.request('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({
        token: validToken,
        password: 'NewPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res1.status).toBe(200);

    // Second reset with same token should fail
    const res2 = await app.request('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({
        token: validToken,
        password: 'AnotherPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res2.status).toBe(400);
    const json = await res2.json();
    expect(json.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
  });

  test('should return 403 for config-managed user', async () => {
    const email = generateUniqueEmail('password-reset-config-managed');

    // Register user via HTTP
    const registerRes = await registerUser(app, {
      email,
      password: 'TestPassword123!',
    });
    expect(registerRes.status).toBe(200);

    // Make user config-managed and generate token
    const token = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ email });
      user.managed_by = 'config';
      await services.mikro.em.flush();

      const resetEntity = await services.passwordResetService.generateToken({
        userId: user.id,
        expiresInHours: 1,
      });
      await services.mikro.em.flush();

      return resetEntity.token;
    });

    const res = await app.request('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({
        token,
        password: 'NewPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe('USER_NOT_EDITABLE');
  });

  test('should validate password format', async () => {
    const res = await app.request('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({
        token: 'some-token',
        password: '123', // Too short / invalid
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
  });

  test('should not require authentication', async () => {
    // This endpoint should be publicly accessible
    const res = await app.request('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({
        token: 'any-token',
        password: 'ValidPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    // Should not return 401 (will be 400 for invalid token)
    expect(res.status).not.toBe(401);
  });
});
