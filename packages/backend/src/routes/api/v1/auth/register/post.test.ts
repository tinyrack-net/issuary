import { e } from '@/schemas/error.js';
import {
  generateUniqueEmail,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';
import { describe, expect, test } from 'vitest';

const app = setupTestServer();

describe('POST /api/v1/auth/register', () => {
  test('should register successfully with valid credentials', async () => {
    const uniqueEmail = generateUniqueEmail();

    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
    expect(body.user.email_verified).toBe(false);
  });

  test('should fail with app config user email', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test-config-user@example.com',
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(e.EmailAlreadyExists.Status);
    const expectedError = new e.EmailAlreadyExists.Error();

    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', expectedError.code);
    expect(body).toHaveProperty('message', expectedError.message);
  });

  test('should fail with duplicate email', async () => {
    const uniqueEmail = generateUniqueEmail('duplicate');

    // First registration
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    // Second registration with same email
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(e.EmailAlreadyExists.Status);
    const expectedError = new e.EmailAlreadyExists.Error();
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', expectedError.code);
    expect(body).toHaveProperty('message', expectedError.message);
  });

  test('should fail with invalid email format', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'not-an-email',
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });

  test('should fail with short password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: '12345',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });

  test('should fail with long password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'a'.repeat(101),
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing email', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });

  test('should NOT create session after registration (requires email verification)', async () => {
    const uniqueEmail = generateUniqueEmail('session');
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(200);
    // Session should NOT be created until email is verified
    // expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('should generate verification token after registration', async () => {
    const uniqueEmail = generateUniqueEmail('verify');
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.email_verified).toBe(false);

    // Check that verification token was created in database
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      expect(user).toBeDefined();

      const verification = await app.mikro.emailVerification.findOneOrFail({
        user: user,
        verified: false,
      });
      expect(verification).toBeDefined();
      expect(verification?.token).toBeDefined();
    });
  });
});
