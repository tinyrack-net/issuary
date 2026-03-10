import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { StandaloneConfigInput } from '@tinyauth/standalone/config';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createStandaloneApp } from './app.js';

const BASE_CONFIG = {
  app: {
    cookie_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
  },
  logging: {
    level: 'silent',
    format: 'json',
  },
  database: {
    type: 'sqlite',
    test: true,
  },
  security: {
    hash_master_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    pbkdf2_iterations: 1000,
  },
} satisfies StandaloneConfigInput;

describe('createStandaloneApp', () => {
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
        '<!doctype html><html><body>standalone static app</body></html>',
        'utf-8',
      );

      const server = await createStandaloneApp({
        config: {
          ...BASE_CONFIG,
          app: {
            ...BASE_CONFIG.app,
            frontend: {
              enabled: true,
              mode: 'static',
              path: publicPath,
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
    let upstream: http.Server;
    let upstreamBase = '';
    let cleanup = async () => {};
    let app: Awaited<ReturnType<typeof createStandaloneApp>>['app'];

    beforeAll(async () => {
      upstream = await new Promise<http.Server>((resolve) => {
        const server = http.createServer((_req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body>standalone proxy app</body></html>');
        });
        server.listen(0, '127.0.0.1', () => {
          resolve(server);
        });
      });

      const address = upstream.address();
      if (typeof address !== 'object' || address === null) {
        throw new Error('Failed to determine upstream address');
      }
      upstreamBase = `http://127.0.0.1:${String(address.port)}`;

      const server = await createStandaloneApp({
        config: {
          ...BASE_CONFIG,
          app: {
            ...BASE_CONFIG.app,
            frontend: {
              enabled: true,
              mode: 'proxy',
              path: upstreamBase,
            },
          },
        },
      });
      app = server.app;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
      await new Promise<void>((resolve) => {
        upstream.close(() => {
          resolve();
        });
      });
    });

    test('proxies frontend requests through the standalone app', async () => {
      const res = await app.request('/register');

      expect(res.status).toBe(200);
      await expect(res.text()).resolves.toContain('standalone proxy app');
    });
  });
});
