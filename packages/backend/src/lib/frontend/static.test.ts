import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { CreateStaticHandlerOptions } from './static.js';
import { createStaticHandler } from './static.js';

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

function createTestApp(
  publicPath: string,
  options?: Omit<CreateStaticHandlerOptions, 'publicPath'>,
) {
  const app = new Hono();
  const handler = createStaticHandler({ publicPath, ...options });
  app.notFound((c) => handler(c));
  return app;
}

describe('createStaticHandler', () => {
  describe('with htmlVariables configured', () => {
    let app: InstanceType<typeof Hono>;
    let publicPath = '';

    beforeAll(async () => {
      publicPath = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'tinyauth-static-handler-'),
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

      app = createTestApp(publicPath, {
        htmlVariables: {
          PAGE_TITLE: 'Test App',
          USER_NAME: 'Alice',
          APP_TITLE: 'My App',
        },
      });
    });

    afterAll(async () => {
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

  describe('with default htmlVariables', () => {
    let app: InstanceType<typeof Hono>;
    let publicPath = '';

    const DEFAULT_INDEX = [
      '<!doctype html>',
      '<html><head><title>{{TITLE}}</title>',
      '<meta name="description" content="{{DESCRIPTION}}">',
      '<link rel="icon" href="{{FAVICON_URL}}">',
      '</head><body></body></html>',
    ].join('\n');

    beforeAll(async () => {
      publicPath = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'tinyauth-static-defaults-'),
      );
      await fs.promises.writeFile(
        path.join(publicPath, 'index.html'),
        DEFAULT_INDEX,
        'utf-8',
      );

      app = createTestApp(publicPath);
    });

    afterAll(async () => {
      await fs.promises.rm(publicPath, { recursive: true, force: true });
    });

    test('applies default variables when none are provided', async () => {
      const res = await app.request('/');

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('<title>Tinyrack</title>');
      expect(body).toContain('content="OIDC Provider for everyone"');
      expect(body).toContain('href="/vite.svg"');
    });
  });

  describe('without htmlVariables', () => {
    let app: InstanceType<typeof Hono>;
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

      app = createTestApp(publicPath);
    });

    afterAll(async () => {
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

  describe('with onResponse', () => {
    let app: InstanceType<typeof Hono>;
    let publicPath = '';

    beforeAll(async () => {
      publicPath = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'tinyauth-static-onresponse-'),
      );
      await fs.promises.writeFile(
        path.join(publicPath, 'index.html'),
        INDEX_HTML,
        'utf-8',
      );
      await fs.promises.writeFile(
        path.join(publicPath, 'test.svg'),
        '<svg></svg>',
        'utf-8',
      );

      app = createTestApp(publicPath, {
        htmlVariables: { APP_TITLE: 'Before Hook' },
        onResponse: async (res) => {
          const ct = res.headers.get('content-type') ?? '';
          if (!ct.includes('text/html')) {
            return res;
          }
          const body = await res.text();
          return new Response(body.replace('Before Hook', 'After Hook'), {
            headers: res.headers,
            status: res.status,
          });
        },
      });
    });

    afterAll(async () => {
      await fs.promises.rm(publicPath, { recursive: true, force: true });
    });

    test('onResponse receives the already-interpolated HTML', async () => {
      const res = await app.request('/');

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('After Hook');
      expect(body).not.toContain('Before Hook');
      expect(body).not.toContain('{{APP_TITLE}}');
    });

    test('onResponse is called for non-HTML files', async () => {
      const res = await app.request('/test.svg');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/svg+xml');
    });

    test('onResponse is called for SPA fallback', async () => {
      const res = await app.request('/nonexistent');

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('After Hook');
    });
  });
});
