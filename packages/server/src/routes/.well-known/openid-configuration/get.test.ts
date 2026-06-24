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
  test('should serve root OIDC discovery with public wildcard CORS', async () => {
    const res = await app.request('/.well-known/openid-configuration', {
      headers: { origin: 'https://client.example.test' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });
  test('should serve direct OIDC discovery JSON for client compatibility', async () => {
    const res = await app.request(
      'http://localhost/.well-known/openid-configuration',
      {
        redirect: 'manual',
      },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    await expect(res.json()).resolves.toMatchObject({
      issuer: 'http://localhost:8080',
      authorization_endpoint: 'http://localhost:8080/oauth/authorize',
      token_endpoint: 'http://localhost:8080/oauth/token',
    });
  });
});
