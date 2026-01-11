import { describe, expect, test } from 'vitest';
import { setupTestServer } from '@/test-utils/index.js';

const app = setupTestServer();

describe('GET /health/ready', () => {
  test('should return 200 with database ok when healthy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/ready',
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
      url: '/health/ready',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('database');
  });
});
