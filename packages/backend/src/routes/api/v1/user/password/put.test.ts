import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  requestWithSession,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';
import type { AppType, ServiceContainer } from '@/types.js';

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

/**
 * Helper to create a user with password and return authenticated session
 */
async function createUserWithPasswordAndSession(
  email: string,
  password: string,
): Promise<string> {
  await withMikroContext(services, async () => {
    const user = services.mikro.user.create({
      email,
      password_hash: password, // Will be hashed by entity lifecycle hook
    });
    user.email_verified = true;
    await services.mikro.em.persist(user).flush();
  });

  const loginRes = await app.request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
  });

  expect(loginRes.status).toBe(200);

  const sessionCookie = extractCookie(loginRes, 'session');

  return sessionCookie;
}

describe('PUT /api/v1/user/password', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.request('/api/v1/user/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: 'oldPassword123!',
        new_password: 'newPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 403 for config users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'PUT',
        body: JSON.stringify({
          current_password: 'changemelater',
          new_password: 'newPassword123!',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('USER_NOT_EDITABLE');
  });

  test('should return 400 when password is not set', async () => {
    const email = generateUniqueEmail('password-put-no-password');

    // Create OAuth-only user and get session
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: null,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      user.password_hash = 'tempPassword123!';
      await services.mikro.em.flush();
    });

    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'tempPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    // Remove password after login
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail(
        { email },
        { populate: ['password_hash'] },
      );
      user.password_hash = null;
      await services.mikro.em.flush();
    });

    const sessionCookie = extractCookie(loginRes, 'session');

    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'PUT',
        body: JSON.stringify({
          current_password: 'somePassword123!',
          new_password: 'newPassword123!',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('PASSWORD_NOT_SET');
  });

  test('should return 401 when current password is incorrect', async () => {
    const email = generateUniqueEmail('password-put-wrong-current');
    const password = 'correctPassword123!';

    const sessionCookie = await createUserWithPasswordAndSession(
      email,
      password,
    );

    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'PUT',
        body: JSON.stringify({
          current_password: 'wrongPassword123!',
          new_password: 'newPassword123!',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  test('should change password successfully', async () => {
    const email = generateUniqueEmail('password-put-success');
    const currentPassword = 'currentPassword123!';
    const newPassword = 'newPassword123!';

    const sessionCookie = await createUserWithPasswordAndSession(
      email,
      currentPassword,
    );

    // Change password
    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify new password works
    const verifyLoginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: newPassword,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(verifyLoginRes.status).toBe(200);

    // Verify old password no longer works
    const oldPasswordLoginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: currentPassword,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(oldPasswordLoginRes.status).toBe(401);
  });

  test('should validate new password format', async () => {
    const email = generateUniqueEmail('password-put-validation');
    const password = 'validPassword123!';

    const sessionCookie = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Try to change to a password that's too short
    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'PUT',
        body: JSON.stringify({
          current_password: password,
          new_password: 'short',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
  });
});
