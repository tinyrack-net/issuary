import { describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { generateUniqueEmail, setupTestServer } from '@/test-utils/index.js';

const app = setupTestServer();

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
    const uniqueEmail = generateUniqueEmail('loginuser');
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

    expect(res.statusCode).toBe(e.InvalidEmailOrPassword.Status);
    const expectedError = new e.InvalidEmailOrPassword.Error();
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', expectedError.code);
    expect(body).toHaveProperty('message', expectedError.message);
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

    expect(res.statusCode).toBe(e.InvalidEmailOrPassword.Status);
    const expectedError = new e.InvalidEmailOrPassword.Error();
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', expectedError.code);
    expect(body).toHaveProperty('message', expectedError.message);
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
