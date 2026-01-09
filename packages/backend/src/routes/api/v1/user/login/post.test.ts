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

describe('POST /api/v1/user/login', () => {
  test('should login successfully with correct credentials (app config user)', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
      payload: {
        email: 'test-config-user@example.com',
        password: 'changemelater',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
  });

  test('should login successfully with correct credentials (registered user)', async () => {
    // First, register a new user
    const uniqueEmail = `loginuser${Date.now()}@example.com`;
    const registerRes = await app.inject({
      method: 'post',
      url: '/api/v1/user/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(registerRes.statusCode).toBe(200);

    // Now, attempt to login with the newly registered user
    const loginRes = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = JSON.parse(loginRes.body);
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
  });

  test('should fail with wrong password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
      payload: {
        email: 'admin@example.com',
        password: 'wrongpassword',
      },
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
    expect(body.message).toBe('Invalid combination of email and password');
  });

  test('should fail with non-existent email', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
      payload: {
        email: 'nonexistent@example.com',
        password: 'anypassword',
      },
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
    expect(body.message).toBe('Invalid combination of email and password');
  });

  test('should fail with invalid email format', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
      payload: {
        email: 'not-an-email',
        password: 'anypassword',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });

  test('should fail with short password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
      payload: {
        email: 'admin@example.com',
        password: '12345',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing email', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
      payload: {
        password: 'changemelater',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/login',
      payload: {
        email: 'admin@example.com',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });
});
