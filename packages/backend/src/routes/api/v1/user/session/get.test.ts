import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '@/lib/app.js';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  extractCookie,
  MINIMAL_TEST_CONFIG,
  requestWithSession,
  TEST_USER,
  TEST_USER_CONFIG,
} from '@/test-utils/index.js';

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

describe('GET /api/v1/user/session', () => {
  test('should return unauthenticated status when user is not logged in', async () => {
    const res = await app.request('/api/v1/user/session', {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty('user');
  });

  test('should return authenticated status when user is logged in', async () => {
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

    const sessionCookie = extractCookie(loginRes, 'session');

    // Now, get session with the cookie
    const sessionRes = await requestWithSession(
      app,
      '/api/v1/user/session',
      {
        method: 'GET',
      },
      sessionCookie,
    );

    expect(sessionRes.status).toBe(200);
    const sessionBody = await sessionRes.json();
    expect(sessionBody).toHaveProperty('user');
    expect(sessionBody.user).toHaveProperty('id');

    // Verify user id matches = logged-in user
    const loginBody = await loginRes.json();
    expect(sessionBody.user.id).toBe(loginBody.user.id);
    expect(sessionBody.user).toHaveProperty('second_factor_required');
  });

  test('should return unauthenticated after logout', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    // Verify session exists
    const maybeHasSessionRes = await requestWithSession(
      app,
      '/api/v1/user/session',
      {
        method: 'GET',
      },
      sessionCookie,
    );

    expect(maybeHasSessionRes.status).toBe(200);
    const sessionBody = await maybeHasSessionRes.json();
    expect(sessionBody).toHaveProperty('user');

    const logoutRes = await requestWithSession(
      app,
      '/api/v1/auth/logout',
      {
        method: 'POST',
      },
      sessionCookie,
    );
    expect(logoutRes.status).toBe(200);

    // Get cookie after logout - parse from Set-Cookie header since session is cleared
    const logoutSetCookieHeader = logoutRes.headers.get('set-cookie');
    const logoutSessionCookie = logoutSetCookieHeader?.split(';')[0];

    // Verify session is unauthenticated after logout
    const maybeNoSessionRes = await app.request('/api/v1/user/session', {
      method: 'GET',
      headers: {
        Cookie: logoutSessionCookie ?? '',
      },
    });

    expect(maybeNoSessionRes.status).toBe(200);
    const sessionBody2 = await maybeNoSessionRes.json();
    expect(sessionBody2).not.toHaveProperty('user');
  });

  test('should return unauthenticated with invalid cookie', async () => {
    const res = await app.request('/api/v1/user/session', {
      method: 'GET',
      headers: {
        Cookie: 'invalid-cookie=invalid-value',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty('user');
  });

  test('should handle multiple session requests with same cookie', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    // Make multiple session requests
    for (let i = 0; i < 3; i++) {
      const sessionRes = await requestWithSession(
        app,
        '/api/v1/user/session',
        {
          method: 'GET',
        },
        sessionCookie,
      );

      expect(sessionRes.status).toBe(200);
      const sessionBody = await sessionRes.json();
      expect(sessionBody.user).toHaveProperty('id');
    }
  });
});
