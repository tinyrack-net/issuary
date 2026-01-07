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

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('message');
    expect(body.message).toBe('Email already exists');
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

  test('should create session after successful registration', async () => {
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
    expect(res.headers['set-cookie']).toBeDefined();
  });
});
