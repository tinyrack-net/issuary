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
 * Helper to create a user with password and return authenticated session and user ID
 */
async function createUserWithPasswordAndSession(
  email: string,
  password: string,
): Promise<{ sessionCookie: string; userId: string }> {
  let userId: string;

  await withMikroContext(app, async () => {
    const user = app.mikro.user.create({
      email,
      password_hash: password, // Will be hashed by entity lifecycle hook
    });
    user.email_verified = true;
    await app.mikro.em.persist(user).flush();
    userId = user.id;
  });

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

  expect(loginRes.statusCode).toBe(200);

  const sessionCookie = loginRes.cookies.find(
    (c) => c.name === 'session',
  )?.value;
  expect(sessionCookie).toBeDefined();

  return { sessionCookie: sessionCookie!, userId: userId! };
}

describe('DELETE /api/v1/user/password', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/user/password',
      payload: {
        current_password: 'somePassword123!',
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
        method: 'DELETE',
        url: '/api/v1/user/password',
        payload: {
          current_password: 'changemelater',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('USER_NOT_EDITABLE');
  });

  test('should return 400 when password is not set', async () => {
    const email = generateUniqueEmail('password-delete-no-password');

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

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/password',
        payload: {
          current_password: 'somePassword123!',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('PASSWORD_NOT_SET');
  });

  test('should return 401 when current password is incorrect', async () => {
    const email = generateUniqueEmail('password-delete-wrong-current');
    const password = 'correctPassword123!';

    const { sessionCookie } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Try to delete with wrong password
    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/password',
        payload: {
          current_password: 'wrongPassword123!',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  test('should return 400 when no OAuth accounts linked', async () => {
    const email = generateUniqueEmail('password-delete-no-oauth');
    const password = 'validPassword123!';

    const { sessionCookie } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Try to delete password without any OAuth accounts
    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/password',
        payload: {
          current_password: password,
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('CANNOT_REMOVE_LAST_AUTH_METHOD');
  });

  test('should remove password when OAuth account is linked', async () => {
    const email = generateUniqueEmail('password-delete-with-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userId } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Link an OAuth account to the user
    await withMikroContext(app, async () => {
      await app.mikro.userOAuth.linkAccount({
        userId,
        providerName: 'google',
        providerUserId: `google-${Date.now()}`,
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
        expiresAt: null,
      });
    });

    // Now delete password
    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/password',
        payload: {
          current_password: password,
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify password login no longer works
    const verifyLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password,
      },
    });

    expect(verifyLoginRes.statusCode).toBe(401);

    // Verify session still returns has_password: false
    const sessionRes = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );

    expect(sessionRes.statusCode).toBe(200);
    const sessionBody = sessionRes.json();
    expect(sessionBody.user.has_password).toBe(false);
  });

  test('should work with multiple OAuth accounts linked', async () => {
    const email = generateUniqueEmail('password-delete-multi-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userId } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Link multiple OAuth accounts
    await withMikroContext(app, async () => {
      await app.mikro.userOAuth.linkAccount({
        userId,
        providerName: 'google',
        providerUserId: `google-multi-${Date.now()}`,
        accessToken: 'fake-access-token-1',
        refreshToken: 'fake-refresh-token-1',
        expiresAt: null,
      });

      await app.mikro.userOAuth.linkAccount({
        userId,
        providerName: 'github',
        providerUserId: `github-multi-${Date.now()}`,
        accessToken: 'fake-access-token-2',
        refreshToken: 'fake-refresh-token-2',
        expiresAt: null,
      });
    });

    // Delete password should succeed
    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/password',
        payload: {
          current_password: password,
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });
});
