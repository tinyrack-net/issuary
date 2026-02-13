import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from '@/test-utils/index.js';
import type { AppType } from '@/types.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
    },
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('POST /api/v1/auth/logout', () => {
  test('should logout successfully with valid session', async () => {
    // First, login to create a session
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(loginRes.status).toBe(200);

    // Extract Set-Cookie header from login response
    const setCookieHeader = loginRes.headers.get('set-cookie');
    expect(setCookieHeader).toBeDefined();

    // Parse cookie value
    const sessionCookie = setCookieHeader?.split(';')[0];

    // Logout with the session cookie
    const logoutRes = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: sessionCookie ?? '',
      },
    });

    expect(logoutRes.status).toBe(200);
    const body = await logoutRes.json();
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should logout successfully even without valid session', async () => {
    // Logout without any session
    const logoutRes = await app.request('/api/v1/auth/logout', {
      method: 'POST',
    });

    expect(logoutRes.status).toBe(200);
    const body = await logoutRes.json();
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should logout successfully with invalid session cookie', async () => {
    // Logout with invalid cookie
    const logoutRes = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: 'invalid-cookie=invalid-value',
      },
    });

    expect(logoutRes.status).toBe(200);
    const body = await logoutRes.json();
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should purge session after logout', async () => {
    // Login to create a session
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(loginRes.status).toBe(200);

    const setCookieHeader = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookieHeader?.split(';')[0];

    // Verify session exists
    const sessionRes1 = await app.request('/api/v1/user/session', {
      method: 'GET',
      headers: {
        Cookie: sessionCookie ?? '',
      },
    });

    expect(sessionRes1.status).toBe(200);
    const sessionBody1 = await sessionRes1.json();
    expect(sessionBody1.user).not.toBeNull();

    // Logout
    const logoutRes = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: sessionCookie ?? '',
      },
    });

    expect(logoutRes.status).toBe(200);

    // Get new cookie after logout
    const logoutSetCookieHeader = logoutRes.headers.get('set-cookie');
    const logoutSessionCookie = logoutSetCookieHeader?.split(';')[0];

    // Verify session is purged after logout
    const sessionRes2 = await app.request('/api/v1/user/session', {
      method: 'GET',
      headers: {
        Cookie: logoutSessionCookie ?? '',
      },
    });

    expect(sessionRes2.status).toBe(200);
    const sessionBody2 = await sessionRes2.json();
    expect(sessionBody2).not.toHaveProperty('user');
  });

  test('should handle multiple logout calls', async () => {
    // Login
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(loginRes.status).toBe(200);

    const setCookieHeader = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookieHeader?.split(';')[0];

    // First logout
    const logoutRes1 = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: sessionCookie ?? '',
      },
    });

    expect(logoutRes1.status).toBe(200);
    const body1 = await logoutRes1.json();
    expect(body1.ok).toBe(true);

    // Second logout with same cookie (should still succeed)
    const logoutRes2 = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: sessionCookie ?? '',
      },
    });

    expect(logoutRes2.status).toBe(200);
    const body2 = await logoutRes2.json();
    expect(body2.ok).toBe(true);
  });
});
