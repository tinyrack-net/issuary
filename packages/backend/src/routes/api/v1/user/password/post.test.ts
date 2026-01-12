import {
  createAuthenticatedSession,
  generateUniqueEmail,
  injectWithSession,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';
import { describe, expect, test } from 'vitest';

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

  const sessionCookie = loginRes.cookies.find((c) => c.name === 'session')
    ?.value as string;
  expect(sessionCookie).toBeDefined();

  return sessionCookie;
}

describe('POST /api/v1/user/password', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/user/password',
      payload: {
        password: 'newPassword123!',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 403 for config users', async () => {
    // Config users cannot modify their password
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/password',
        payload: {
          password: 'newPassword123!',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('USER_NOT_EDITABLE');
  });

  test('should return 409 when password is already set', async () => {
    const email = generateUniqueEmail('password-post-already-set');
    const password = 'testPassword123!';

    const sessionCookie = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Try to set password again
    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/password',
        payload: {
          password: 'anotherPassword123!',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.code).toBe('PASSWORD_ALREADY_SET');
  });

  test('should set password for OAuth-only user', async () => {
    const email = generateUniqueEmail('password-post-oauth-only');
    const newPassword = 'newPassword123!';

    // Create OAuth-only user and get session
    await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: null,
      });
      user.email_verified = true;
      await app.mikro.em.persist(user).flush();

      // Create a temporary password for login
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

    expect(loginRes.statusCode).toBe(200);

    // Remove password after login to simulate OAuth-only user
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail(
        { email },
        { populate: ['password_hash'] },
      );
      user.password_hash = null;
      await app.mikro.em.flush();
    });

    const sessionCookie = loginRes.cookies.find((c) => c.name === 'session')
      ?.value as string;
    expect(sessionCookie).toBeDefined();

    // Now set password for OAuth-only user
    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/password',
        payload: {
          password: newPassword,
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify password was set by trying to login
    const verifyLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: newPassword,
      },
    });

    expect(verifyLoginRes.statusCode).toBe(200);
  });

  test('should validate password format', async () => {
    const email = generateUniqueEmail('password-post-validation');

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

    const sessionCookie = loginRes.cookies.find((c) => c.name === 'session')
      ?.value as string;
    expect(sessionCookie).toBeDefined();

    // Try to set a password that's too short
    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/password',
        payload: {
          password: 'short',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });
});
