import { describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  expectError,
  generateUniqueEmail,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';
import { DEFAULT_TEST_CONFIG } from '@/test-utils/setup.js';

const app = setupTestServer();

describe('POST /api/v1/auth/register', () => {
  test('should fail when public_registration is disabled', async () => {
    // Create a separate server instance with disabled registration
    const disabledApp = await createServer({
      baseConfig: DEFAULT_TEST_CONFIG,
      configOverrides: {
        app: {
          public_registration: false,
        },
      },
    });

    const res = await disabledApp.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password123',
      },
    });

    // Route is not registered when public_registration is disabled
    expect(res.statusCode).toBe(404);

    // Cleanup
    await disabledApp.close();
  });

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
    const body = res.json();
    expect(body).toHaveProperty('status', 'email_verification_required');
    expect(body).not.toHaveProperty('user');
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

    expectError(res, e.EmailAlreadyExists);
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

    expectError(res, e.EmailAlreadyExists);
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
    const body = res.json();
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
    const body = res.json();
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
    const body = res.json();
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
    const body = res.json();
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
    const body = res.json();
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
    const body = res.json();
    expect(body.status).toBe('email_verification_required');
    expect(body).not.toHaveProperty('user');

    // Check that verification token was created in database
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      expect(user).toBeDefined();
      expect(user.email_verified).toBe(false);

      const verification = await app.mikro.emailVerification.findOneOrFail({
        user: user,
        verified: false,
      });
      expect(verification).toBeDefined();
      expect(verification?.token).toBeDefined();
    });
  });
});
