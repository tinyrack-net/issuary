import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer().start();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

describe('POST /api/v1/user/logout', () => {
  test('should logout successfully with valid session', async () => {
    // First, login to create a session
    const loginRes = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
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

    // Logout with the session cookie
    const logoutRes = await app.inject({
      method: 'post',
      url: '/api/v1/user/logout',
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(logoutRes.statusCode).toBe(200);
    const body = JSON.parse(logoutRes.body);
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should logout successfully even without valid session', async () => {
    // Logout without any session
    const logoutRes = await app.inject({
      method: 'post',
      url: '/api/v1/user/logout',
    });

    expect(logoutRes.statusCode).toBe(200);
    const body = JSON.parse(logoutRes.body);
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should logout successfully with invalid session cookie', async () => {
    // Logout with invalid cookie
    const logoutRes = await app.inject({
      method: 'post',
      url: '/api/v1/user/logout',
      headers: {
        cookie: 'invalid-cookie=invalid-value',
      },
    });

    expect(logoutRes.statusCode).toBe(200);
    const body = JSON.parse(logoutRes.body);
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should purge session after logout', async () => {
    // Login to create a session
    const loginRes = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
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
    const sessionRes1 = await app.inject({
      method: 'get',
      url: '/api/v1/user/session',
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(sessionRes1.statusCode).toBe(200);
    const sessionBody1 = JSON.parse(sessionRes1.body);
    expect(sessionBody1.user).not.toBeNull();

    // Logout
    const logoutRes = await app.inject({
      method: 'post',
      url: '/api/v1/user/logout',
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(logoutRes.statusCode).toBe(200);

    // Get new cookie after logout
    const logoutSetCookieHeader = logoutRes.headers['set-cookie'];
    const logoutCookieValue = Array.isArray(logoutSetCookieHeader)
      ? logoutSetCookieHeader[0]
      : logoutSetCookieHeader;
    const logoutSessionCookie = logoutCookieValue?.split(';')[0];

    // Verify session is purged after logout
    const sessionRes2 = await app.inject({
      method: 'get',
      url: '/api/v1/user/session',
      headers: {
        cookie: logoutSessionCookie,
      },
    });

    expect(sessionRes2.statusCode).toBe(200);
    const sessionBody2 = JSON.parse(sessionRes2.body);
    expect(sessionBody2.user).toBeNull();
  });

  test('should handle multiple logout calls', async () => {
    // Login
    const loginRes = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
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

    // First logout
    const logoutRes1 = await app.inject({
      method: 'post',
      url: '/api/v1/user/logout',
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(logoutRes1.statusCode).toBe(200);
    const body1 = JSON.parse(logoutRes1.body);
    expect(body1.ok).toBe(true);

    // Second logout with same cookie (should still succeed)
    const logoutRes2 = await app.inject({
      method: 'post',
      url: '/api/v1/user/logout',
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(logoutRes2.statusCode).toBe(200);
    const body2 = JSON.parse(logoutRes2.body);
    expect(body2.ok).toBe(true);
  });
});
