import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  extractCookie,
  generateUniqueEmail,
  injectWithSession,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

const app = setupTestServer();

/**
 * Helper to create a user with password and return authenticated session
 */
async function createUserWithPasswordAndSession(
  email: string,
  password: string,
): Promise<string> {
  await withMikroContext(app, async () => {
    const user = app.mikro.user.create({
      email,
      password_hash: password, // Will be hashed by entity lifecycle hook
    });
    user.email_verified = true;
    await app.mikro.em.persist(user).flush();
  });

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

  expect(loginRes.statusCode).toBe(200);

  const sessionCookie = extractCookie(loginRes, 'session');

  return sessionCookie;
}

describe('PUT /api/v1/user/password', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/user/password',
      payload: {
        current_password: 'oldPassword123!',
        new_password: 'newPassword123!',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 403 for config users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await injectWithSession(
      app,
      {
        method: 'PUT',
        url: '/api/v1/user/password',
        payload: {
          current_password: 'changemelater',
          new_password: 'newPassword123!',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('USER_NOT_EDITABLE');
  });

  test('should return 400 when password is not set', async () => {
    const email = generateUniqueEmail('password-put-no-password');

    // Create OAuth-only user and get session
    await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: null,
      });
      user.email_verified = true;
      await app.mikro.em.persist(user).flush();

      user.password_hash = 'tempPassword123!';
      await app.mikro.em.flush();
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: 'tempPassword123!',
      },
    });

    // Remove password after login
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail(
        { email },
        { populate: ['password_hash'] },
      );
      user.password_hash = null;
      await app.mikro.em.flush();
    });

    const sessionCookie = extractCookie(loginRes, 'session');

    const res = await injectWithSession(
      app,
      {
        method: 'PUT',
        url: '/api/v1/user/password',
        payload: {
          current_password: 'somePassword123!',
          new_password: 'newPassword123!',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('PASSWORD_NOT_SET');
  });

  test('should return 401 when current password is incorrect', async () => {
    const email = generateUniqueEmail('password-put-wrong-current');
    const password = 'correctPassword123!';

    const sessionCookie = await createUserWithPasswordAndSession(
      email,
      password,
    );

    const res = await injectWithSession(
      app,
      {
        method: 'PUT',
        url: '/api/v1/user/password',
        payload: {
          current_password: 'wrongPassword123!',
          new_password: 'newPassword123!',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(401);
    const body = res.json();
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
    const res = await injectWithSession(
      app,
      {
        method: 'PUT',
        url: '/api/v1/user/password',
        payload: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify new password works
    const verifyLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: newPassword,
      },
    });

    expect(verifyLoginRes.statusCode).toBe(200);

    // Verify old password no longer works
    const oldPasswordLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: currentPassword,
      },
    });

    expect(oldPasswordLoginRes.statusCode).toBe(401);
  });

  test('should validate new password format', async () => {
    const email = generateUniqueEmail('password-put-validation');
    const password = 'validPassword123!';

    const sessionCookie = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Try to change to a password that's too short
    const res = await injectWithSession(
      app,
      {
        method: 'PUT',
        url: '/api/v1/user/password',
        payload: {
          current_password: password,
          new_password: 'short',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });
});
