import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  extractCookie,
  injectWithSession,
  setupTestServer,
  TEST_USER,
} from '@/test-utils/index.js';

const app = setupTestServer();

describe('GET /api/v1/user/session', () => {
  test('should return unauthenticated status when user is not logged in', async () => {
    const res = await app.inject({
      method: 'get',
      url: '/api/v1/user/session',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).not.toHaveProperty('user');
  });

  test('should return authenticated status when user is logged in', async () => {
    // First, login to create a session
    const loginRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.statusCode).toBe(200);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Now, get session with the cookie
    const sessionRes = await injectWithSession(
      app,
      {
        method: 'get',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );

    expect(sessionRes.statusCode).toBe(200);
    const sessionBody = sessionRes.json();
    expect(sessionBody).toHaveProperty('user');
    expect(sessionBody.user).toHaveProperty('id');

    // Verify user id matches = logged-in user
    const loginBody = loginRes.json();
    expect(sessionBody.user.id).toBe(loginBody.user.id);
    expect(sessionBody.user).toHaveProperty('second_factor_required');
  });

  test('should return unauthenticated after logout', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    // Verify session exists
    const maybeHasSessionRes = await injectWithSession(
      app,
      {
        method: 'get',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );

    expect(maybeHasSessionRes.statusCode).toBe(200);
    const sessionBody = maybeHasSessionRes.json();
    expect(sessionBody).toHaveProperty('user');

    const logoutRes = await injectWithSession(
      app,
      {
        method: 'post',
        url: '/api/v1/auth/logout',
      },
      sessionCookie,
    );
    expect(logoutRes.statusCode).toBe(200);

    // Get cookie after logout - parse from Set-Cookie header since session is cleared
    const logoutSetCookieHeader = logoutRes.headers['set-cookie'];
    const logoutCookieValue = Array.isArray(logoutSetCookieHeader)
      ? logoutSetCookieHeader[0]
      : logoutSetCookieHeader;
    const logoutSessionCookie = logoutCookieValue?.split(';')[0];

    // Verify session is unauthenticated after logout
    const maybeNoSessionRes = await app.inject({
      method: 'get',
      url: '/api/v1/user/session',
      headers: {
        cookie: logoutSessionCookie,
      },
    });

    expect(maybeNoSessionRes.statusCode).toBe(200);
    const sessionBody2 = maybeNoSessionRes.json();
    expect(sessionBody2).not.toHaveProperty('user');
  });

  test('should return unauthenticated with invalid cookie', async () => {
    const res = await app.inject({
      method: 'get',
      url: '/api/v1/user/session',
      headers: {
        cookie: 'invalid-cookie=invalid-value',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).not.toHaveProperty('user');
  });

  test('should handle multiple session requests with same cookie', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    // Make multiple session requests
    for (let i = 0; i < 3; i++) {
      const sessionRes = await injectWithSession(
        app,
        {
          method: 'get',
          url: '/api/v1/user/session',
        },
        sessionCookie,
      );

      expect(sessionRes.statusCode).toBe(200);
      const sessionBody = sessionRes.json();
      expect(sessionBody.user).toHaveProperty('id');
    }
  });
});
