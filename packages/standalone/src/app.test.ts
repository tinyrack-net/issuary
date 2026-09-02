import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { StandaloneConfigInput } from './lib/config/index.ts';

const BASE_CONFIG = {
  logging: { level: 'silent', format: 'json' },
  database: { type: 'sqlite', test: true },
  security: {
    session_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    pbkdf2_iterations: 1000,
  },
} satisfies StandaloneConfigInput;

describe('createStandaloneApp', () => {
  let createStandaloneApp: typeof import('./app.ts').createStandaloneApp;

  beforeAll(async () => {
    ({ createStandaloneApp } = await import('./app.ts'));
  });

  describe('bundled frontend', () => {
    let cleanup = async () => {};
    let app: Awaited<ReturnType<typeof createStandaloneApp>>['app'];

    beforeAll(async () => {
      const server = await createStandaloneApp({
        config: {
          ...BASE_CONFIG,
          branding: {
            title: { en: 'Standalone Issuary' },
          },
        },
      });
      app = server.app;
      cleanup = server.cleanup;
    });

    afterAll(async () => cleanup());

    test('server-renders the login document from the same process', async () => {
      const response = await app.request('/login/password', {
        headers: { 'Accept-Language': 'en-US' },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      await expect(response.text()).resolves.toContain(
        '<title>Standalone Issuary</title>',
      );
    });

    test('does not turn missing API routes into HTML', async () => {
      const response = await app.request('/api/nonexistent');
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain(
        'application/json',
      );
    });

    test('redirects an anonymous admin request through its parent loader', async () => {
      const response = await app.request('/admin');
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/login');
    });
  });

  test('forwards an injected React Router runtime to the server', async () => {
    let buildLoadCount = 0;
    const server = await createStandaloneApp({
      config: BASE_CONFIG,
      runtimeOptions: {
        reactRouter: {
          loadServerBuild: async () => {
            buildLoadCount += 1;
            throw new Error('development build unavailable');
          },
        },
      },
    });

    const response = await server.app.request('/login/password');

    expect(response.status).toBe(500);
    expect(buildLoadCount).toBe(1);
    await server.cleanup();
  });
});
