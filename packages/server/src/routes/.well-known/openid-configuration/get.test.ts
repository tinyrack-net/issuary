import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#server/entrypoints/app.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '#server/test-utils/index.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp(MINIMAL_TEST_CONFIG);
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /.well-known/openid-configuration', () => {
  test('should redirect to the oauth discovery endpoint', async () => {
    const res = await app.request(
      'http://localhost/.well-known/openid-configuration',
      {
        redirect: 'manual',
      },
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      '/oauth/.well-known/openid-configuration',
    );
  });
});
