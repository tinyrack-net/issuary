import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import { MINIMAL_TEST_CONFIG } from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/health/ready', () => {
  test('should return 200 with database ok when healthy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health/ready',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toEqual({
      status: 'ok',
      checks: {
        database: 'ok',
      },
    });
  });

  test('should have proper response structure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health/ready',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('database');
  });
});
