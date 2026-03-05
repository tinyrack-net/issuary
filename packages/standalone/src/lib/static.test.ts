import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AppType } from '@tinyauth/backend';
import type { StandaloneConfigInput } from '@tinyauth/standalone/config';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createStandaloneApp } from '#standalone/app.js';

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

const INDEX_HTML = [
  '<!doctype html>',
  '<html><head><title>{{APP_TITLE}}</title></head>',
  '<body><div id="root"></div></body>',
  '</html>',
].join('\n');

const TEST_HTML = [
  '<!doctype html>',
  '<html>',
  '<head><title>{{PAGE_TITLE}}</title></head>',
  '<body><p>Hello {{USER_NAME}}</p></body>',
  '</html>',
].join('\n');

describe('registerStaticRoutes', () => {
  describe('with html_variables configured', () => {
    let app: AppType;
    let cleanup: () => Promise<void>;
    let publicPath = '';

    beforeAll(async () => {
      publicPath = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'tinyauth-static-routes-'),
      );
      await fs.promises.mkdir(path.join(publicPath, 'test-subdir'), {
        recursive: true,
      });
      await fs.promises.writeFile(
        path.join(publicPath, 'index.html'),
        INDEX_HTML,
        'utf-8',
      );
      await fs.promises.writeFile(
        path.join(publicPath, 'test-interpolation.html'),
        TEST_HTML,
        'utf-8',
      );
      await fs.promises.writeFile(
        path.join(publicPath, 'test-subdir', 'index.html'),
        TEST_HTML,
        'utf-8',
      );
      await fs.promises.writeFile(
        path.join(publicPath, 'test.svg'),
        '<svg></svg>',
        'utf-8',
      );

      ({ app, cleanup } = await createStandaloneApp({
        config: {
          ...BASE_CONFIG,
          app: {
            ...BASE_CONFIG.app,
            html_variables: {
              PAGE_TITLE: 'Test App',
              USER_NAME: 'Alice',
              APP_TITLE: 'My App',
            },
            frontend: {
              enabled: true,
              mode: 'static',
              path: publicPath,
            },
          },
        },
      }));
    });

    afterAll(async () => {
      await cleanup();
      await fs.promises.rm(publicPath, { recursive: true, force: true });
    });

    test('interpolates variables in directly requested HTML', async () => {
      const res = await app.request('/test-interpolation.html');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain('<title>Test App</title>');
      expect(body).toContain('Hello Alice');
    });

    test('interpolates variables in SPA fallback', async () => {
      const res = await app.request('/nonexistent-route');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain('<title>My App</title>');
    });

    test('interpolates variables in directory index.html', async () => {
      const res = await app.request('/test-subdir');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain('<title>Test App</title>');
    });

    test('serves non-HTML files with correct content type', async () => {
      const res = await app.request('/test.svg');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/svg+xml');
    });

    test('returns 404 for API routes', async () => {
      const res = await app.request('/api/nonexistent');

      expect(res.status).toBe(404);
    });

    test('does not serve files outside the public directory', async () => {
      const res = await app.request('/../package.json');

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('<title>My App</title>');
      expect(body).not.toContain('"name"');
    });

    test('caches HTML and returns identical content', async () => {
      const res1 = await app.request('/test-interpolation.html');
      const res2 = await app.request('/test-interpolation.html');

      const body1 = await res1.text();
      const body2 = await res2.text();
      expect(body1).toBe(body2);
    });
  });

  describe('without html_variables', () => {
    let app: AppType;
    let cleanup: () => Promise<void>;
    let publicPath = '';

    beforeAll(async () => {
      publicPath = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'tinyauth-static-plain-'),
      );
      await fs.promises.writeFile(
        path.join(publicPath, 'index.html'),
        INDEX_HTML,
        'utf-8',
      );
      await fs.promises.writeFile(
        path.join(publicPath, 'test-interpolation.html'),
        TEST_HTML,
        'utf-8',
      );

      ({ app, cleanup } = await createStandaloneApp({
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
      }));
    });

    afterAll(async () => {
      await cleanup();
      await fs.promises.rm(publicPath, { recursive: true, force: true });
    });

    test('serves HTML with placeholders intact', async () => {
      const res = await app.request('/test-interpolation.html');

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('{{PAGE_TITLE}}');
      expect(body).toContain('{{USER_NAME}}');
    });

    test('serves SPA fallback normally', async () => {
      const res = await app.request('/nonexistent-route');

      expect(res.status).toBe(200);
      await expect(res.text()).resolves.toContain('<!doctype html>');
    });

    test('does not serve files outside the public directory', async () => {
      const res = await app.request('/../package.json');

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('<!doctype html>');
      expect(body).not.toContain('"name"');
    });
  });
});
