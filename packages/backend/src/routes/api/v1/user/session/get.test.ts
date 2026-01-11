import { describe, expect, test } from 'vitest';
import { setupTestServer } from '@/test-utils/index.js';

const app = setupTestServer();

describe('GET /api/v1/user/session', () => {
  test('should return authenticated: false when user is not logged in', async () => {
    const res = await app.inject({
      method: 'get',
      url: '/api/v1/user/session',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('user', null);
  });

  test('should return user session when user is logged in', async () => {
    // First, login to create a session
    const loginRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test-config-user@example.com',
        password: 'changemelater',
      },
    });

    expect(loginRes.statusCode).toBe(200);

    // Extract Set-Cookie header from login response
    const setCookieHeader = loginRes.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();

    // Parse cookie value (handle both string and array)
    const cookieValue = Array.isArray(setCookieHeader)
      ? setCookieHeader[0]
      : setCookieHeader;
    const sessionCookie = cookieValue?.split(';')[0];

    // Now, get session with the cookie
    const sessionRes = await app.inject({
      method: 'get',
      url: '/api/v1/user/session',
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(sessionRes.statusCode).toBe(200);
    const sessionBody = JSON.parse(sessionRes.body);
    expect(sessionBody).toHaveProperty('user');
    expect(sessionBody.user).not.toBeNull();
    expect(sessionBody.user).toHaveProperty('id');

    // Verify user id matches the logged-in user
    const loginBody = JSON.parse(loginRes.body);
    expect(sessionBody.user.id).toBe(loginBody.user.id);
  });

  test('should return null after logout', async () => {
    const loginRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test-config-user@example.com',
        password: 'changemelater',
      },
    });

    expect(loginRes.statusCode).toBe(200);

    const setCookieHeader = loginRes.headers['set-cookie'];
    const cookieValue = Array.isArray(setCookieHeader)
      ? setCookieHeader[0]
      : setCookieHeader;
    const sessionCookie = cookieValue?.split(';')[0];

    // Verify session exists
    const maybeHasSessionRes = await app.inject({
      method: 'get',
      url: '/api/v1/user/session',
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(maybeHasSessionRes.statusCode).toBe(200);
    const sessionBody = JSON.parse(maybeHasSessionRes.body);
    expect(sessionBody.user).not.toBeNull();

    const logoutRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: sessionCookie,
      },
    });
    expect(logoutRes.statusCode).toBe(200);

    // Get cookie after logout
    const logoutSetCookieHeader = logoutRes.headers['set-cookie'];
    const logoutCookieValue = Array.isArray(logoutSetCookieHeader)
      ? logoutSetCookieHeader[0]
      : logoutSetCookieHeader;
    const logoutSessionCookie = logoutCookieValue?.split(';')[0];

    // Verify session is null after logout
    const maybeNoSessionRes = await app.inject({
      method: 'get',
      url: '/api/v1/user/session',
      headers: {
        cookie: logoutSessionCookie,
      },
    });

    expect(maybeNoSessionRes.statusCode).toBe(200);
    const sessionBody2 = JSON.parse(maybeNoSessionRes.body);
    expect(sessionBody2.user).toBeNull();
  });

  test('should return authenticated: false with invalid cookie', async () => {
    const res = await app.inject({
      method: 'get',
      url: '/api/v1/user/session',
      headers: {
        cookie: 'invalid-cookie=invalid-value',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('user', null);
  });

  test('should handle multiple session requests with same cookie', async () => {
    // Login once
    const loginRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test-config-user@example.com',
        password: 'changemelater',
      },
    });

    expect(loginRes.statusCode).toBe(200);

    const setCookieHeader = loginRes.headers['set-cookie'];
    const cookieValue = Array.isArray(setCookieHeader)
      ? setCookieHeader[0]
      : setCookieHeader;
    const sessionCookie = cookieValue?.split(';')[0];

    // Make multiple session requests
    for (let i = 0; i < 3; i++) {
      const sessionRes = await app.inject({
        method: 'get',
        url: '/api/v1/user/session',
        headers: {
          cookie: sessionCookie,
        },
      });

      expect(sessionRes.statusCode).toBe(200);
      const sessionBody = JSON.parse(sessionRes.body);
      expect(sessionBody.user).not.toBeNull();
      expect(sessionBody.user).toHaveProperty('id');
    }
  });
});
