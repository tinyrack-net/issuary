import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { StandaloneConfigInput } from './lib/config/index.ts';

const BASE_CONFIG = {
  logging: {
    level: 'silent',
    format: 'json',
  },
  database: {
    type: 'sqlite',
    test: true,
  },
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

  describe('static frontend mode', () => {
    let publicPath = '';
    let cleanup = async () => {};
    let app: Awaited<ReturnType<typeof createStandaloneApp>>['app'];

    beforeAll(async () => {
      publicPath = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'tinyauth-static-app-'),
      );
      await fs.promises.writeFile(
        path.join(publicPath, 'index.html'),
        '<!doctype html><html><body>{{APP_NAME}}</body></html>',
        'utf-8',
      );

      const server = await createStandaloneApp({
        config: {
          ...BASE_CONFIG,
          frontend: {
            enabled: true,
            mode: 'static',
            path: publicPath,
            html_variables: {
              APP_NAME: 'standalone static app',
            },
          },
        },
      });
      app = server.app;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
      await fs.promises.rm(publicPath, { recursive: true, force: true });
    });

    test('serves static frontend fallback', async () => {
      const res = await app.request('/login');

      expect(res.status).toBe(200);
      await expect(res.text()).resolves.toContain('standalone static app');
    });

    test('delegates unmatched API routes to frontend handler', async () => {
      const res = await app.request('/api/nonexistent');

      expect(res.status).toBe(200);
      await expect(res.text()).resolves.toContain('standalone static app');
    });
  });

  describe('proxy frontend mode', () => {
    let cleanup = async () => {};
    let app: Awaited<ReturnType<typeof createStandaloneApp>>['app'];
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response('<html><body>{{APP_NAME}}</body></html>', {
          headers: {
            'content-type': 'text/html',
          },
        });
      });

      const server = await createStandaloneApp({
        config: {
          ...BASE_CONFIG,
          frontend: {
            enabled: true,
            mode: 'proxy',
            path: 'https://frontend.example.test',
            html_variables: {
              APP_NAME: 'standalone proxy app',
            },
          },
        },
      });
      app = server.app;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
      fetchSpy.mockRestore();
    });

    test('proxies frontend requests through the standalone app', async () => {
      const res = await app.request('/register');

      expect(res.status).toBe(200);
      await expect(res.text()).resolves.toContain('standalone proxy app');
    });

    test('proxies requests to the configured upstream URL', async () => {
      await app.request('/register');

      const firstInput = fetchSpy.mock.calls[0]?.[0];

      if (!firstInput) {
        throw new Error('Expected fetch to be called');
      }

      const upstreamUrl =
        typeof firstInput === 'string'
          ? firstInput
          : firstInput instanceof URL
            ? firstInput.toString()
            : firstInput.url;

      expect(upstreamUrl).toBe('https://frontend.example.test/register');
    });
  });
});
