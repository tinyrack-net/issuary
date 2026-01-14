import { describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import {
  expectError,
  generateUniqueEmail,
  setupTestServer,
} from '@/test-utils/index.js';

const app = setupTestServer();

describe('POST /api/v1/auth/login', () => {
  test('should login successfully with correct credentials (app config user)', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test-config-user@example.com',
        password: 'changemelater',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
  });

  test('should login successfully with correct credentials (registered user)', async () => {
    // First, register a new user
    const uniqueEmail = generateUniqueEmail('loginuser');
    const registerRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(registerRes.statusCode).toBe(200);

    // Now, attempt to login with the newly registered user
    const loginRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
  });

  test('should fail with wrong password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@example.com',
        password: 'wrongpassword',
      },
    });

    expectError(res, e.InvalidEmailOrPassword);
  });

  test('should fail with non-existent email', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: 'nonexistent@example.com',
        password: 'anypassword',
      },
    });

    expectError(res, e.InvalidEmailOrPassword);
  });

  test('should fail with invalid email format', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: 'not-an-email',
        password: 'anypassword',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with short password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@example.com',
        password: '12345',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing email', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        password: 'changemelater',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@example.com',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail to login with deleted user', async () => {
    const uniqueEmail = generateUniqueEmail('deleteduser');
    const password = 'password123';

    // First, register a new user
    const registerRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: password,
      },
    });
    expect(registerRes.statusCode).toBe(200);

    // Verify user can login before deletion
    const loginBeforeRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: uniqueEmail,
        password: password,
      },
    });
    expect(loginBeforeRes.statusCode).toBe(200);

    // Soft delete the user by setting deleted_at
    await app.mikro.em.fork().transactional(async (em) => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      user.deleted_at = new Date();
      await em.flush();
    });

    // Attempt to login with deleted user
    const loginAfterRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: uniqueEmail,
        password: password,
      },
    });

    // Should fail with InvalidEmailOrPassword error
    expectError(loginAfterRes, e.InvalidEmailOrPassword);
  });
});
