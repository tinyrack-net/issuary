import { describe, expect, test } from 'vitest';
import { setupTestServer } from '@/test-utils/index.js';

const app = setupTestServer();

describe('GET /api/v1/health/live', () => {
  test('should return 200 with status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health/live',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toEqual({
      status: 'ok',
    });
  });

  test('should respond quickly (no heavy operations)', async () => {
    const start = Date.now();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health/live',
    });

    const duration = Date.now() - start;

    expect(res.statusCode).toBe(200);
    expect(duration).toBeLessThan(100); // Should respond within 100ms
  });
});
