import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll } from 'vitest';
import { createServer } from '@/server.js';

/**
 * Global app instance for tests
 */
let appInstance: FastifyInstance | null = null;

/**
 * Setup and teardown Fastify server for tests.
 * Call this function in your test file to automatically set up and tear down the server.
 *
 * @example
 * ```typescript
 * import { setupTestServer } from '@/test-utils/setup.js';
 *
 * const app = setupTestServer();
 *
 * describe('My Tests', () => {
 *   test('should work', async () => {
 *     const res = await app.inject({ method: 'GET', url: '/' });
 *     expect(res.statusCode).toBe(200);
 *   });
 * });
 * ```
 */
export function setupTestServer(): FastifyInstance {
  beforeAll(async () => {
    appInstance = await createServer().start();
  });

  afterAll(async () => {
    if (appInstance) {
      await appInstance.close();
      appInstance = null;
    }
  });

  // Return a proxy that throws if accessed before initialization
  return new Proxy({} as FastifyInstance, {
    get(_target, prop) {
      if (!appInstance) {
        throw new Error(
          'Test server not initialized. Make sure tests run within beforeAll/afterAll hooks.',
        );
      }
      return appInstance[prop as keyof FastifyInstance];
    },
  });
}
