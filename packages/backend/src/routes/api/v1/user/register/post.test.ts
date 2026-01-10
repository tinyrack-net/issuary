import { RequestContext } from '@mikro-orm/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
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

describe('POST /api/v1/user/register', () => {
  test('should register successfully with valid credentials', async () => {
    const uniqueEmail = `test${Date.now()}@example.com`;

    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/register',
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
      url: '/api/v1/user/register',
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
    const uniqueEmail = `duplicate${Date.now()}@example.com`;

    // First registration
    await app.inject({
      method: 'post',
      url: '/api/v1/user/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    // Second registration with same email
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/register',
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
      url: '/api/v1/user/register',
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
      url: '/api/v1/user/register',
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
      url: '/api/v1/user/register',
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
      url: '/api/v1/user/register',
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
      url: '/api/v1/user/register',
      payload: {
        email: 'test@example.com',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
  });

  test('should NOT create session after registration (requires email verification)', async () => {
    const uniqueEmail = `session${Date.now()}@example.com`;
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/register',
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
    const uniqueEmail = `verify${Date.now()}@example.com`;
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/user/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.email_verified).toBe(false);

    // Check that verification token was created in database
    await RequestContext.create(app.mikro.em, async () => {
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
