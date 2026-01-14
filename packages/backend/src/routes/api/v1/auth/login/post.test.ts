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
    expect(body.email_verification_required).toBe(false);
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
    // Since email_verification is enabled in test config, unverified user should get email_verification_required
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
    // Unverified user should require email verification
    expect(body.email_verification_required).toBe(true);
    expect(body.email).toBe(uniqueEmail);
    expect(body).not.toHaveProperty('user');
  });

  test('should require email verification for unverified user when email_verification is enabled', async () => {
    // Register a new user (email_verified will be false by default)
    const uniqueEmail = generateUniqueEmail('unverified');
    const registerRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(registerRes.statusCode).toBe(200);

    // Try to login - should require email verification
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
    expect(body.email_verification_required).toBe(true);
    expect(body.totp_verification_required).toBe(false);
    expect(body.totp_setup_required).toBe(false);
    expect(body.email).toBe(uniqueEmail);
    expect(body).not.toHaveProperty('user');
  });

  test('should login successfully after email is verified', async () => {
    // Register a new user
    const uniqueEmail = generateUniqueEmail('verified');
    const registerRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(registerRes.statusCode).toBe(200);

    // Manually verify the email in the database
    await app.mikro.em.fork().transactional(async (em) => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      user.email_verified = true;
      await em.flush();
    });

    // Now login should succeed
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
    expect(body.email_verification_required).toBe(false);
    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe(uniqueEmail);
    expect(body.user.email_verified).toBe(true);
  });

  test('should allow config user to login without email verification', async () => {
    // Config users should bypass email verification requirement
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
    expect(body.email_verification_required).toBe(false);
    expect(body).toHaveProperty('user');
    expect(body.user.managed_by).toBe('config');
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

    // Verify user can login before deletion (will require email verification)
    const loginBeforeRes = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: {
        email: uniqueEmail,
        password: password,
      },
    });
    expect(loginBeforeRes.statusCode).toBe(200);
    // Unverified user will get email_verification_required
    const beforeBody = loginBeforeRes.json();
    expect(beforeBody.email_verification_required).toBe(true);

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
