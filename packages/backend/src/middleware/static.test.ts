import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/app.js';
import { createApp } from '#backend/app.js';
import { MINIMAL_TEST_CONFIG } from '#backend/test-utils/index.js';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

// The static middleware uses the path from config.app.frontend.path.
// We write test fixtures into <backend-root>/public/ and pass that
// path to the config so the middleware can find them.
const publicPath = path.join(__dirname, '../../public');

// Track whether we created the public directory so we know
// whether to remove the whole directory or just test files.
let createdPublicDir = false;

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

// Files managed by these tests — only these are removed on cleanup.
const TEST_FILES = [
  'index.html',
  'test-interpolation.html',
  'test.svg',
  'test-subdir/index.html',
];

async function setupTestFiles(): Promise<void> {
  try {
    await fs.promises.stat(publicPath);
  } catch {
    createdPublicDir = true;
  }

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
}

async function cleanupTestFiles(): Promise<void> {
  if (createdPublicDir) {
    // We created the whole directory — safe to remove it entirely
    await fs.promises.rm(publicPath, { recursive: true, force: true });
    return;
  }

  // Only remove the files we created, leave other files intact
  for (const file of TEST_FILES) {
    await fs.promises
      .rm(path.join(publicPath, file), { force: true })
      .catch(() => {});
  }
  // Try to remove the test subdirectory (only succeeds if empty)
  await fs.promises.rmdir(path.join(publicPath, 'test-subdir')).catch(() => {});
}

// All routes tested here are handled by the prod static/notFound handler and
// are NOT part of the typed OpenAPI route system, so we use app.request().
describe('static prod plugin - html_variables integration', () => {
  describe('with html_variables configured', () => {
    let app: AppType;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      await setupTestFiles();
      ({ app, cleanup } = await createApp({
        config: {
          ...MINIMAL_TEST_CONFIG,
          app: {
            ...MINIMAL_TEST_CONFIG.app,
            html_variables: {
              PAGE_TITLE: 'Test App',
              USER_NAME: 'Alice',
              APP_TITLE: 'My App',
            },
            frontend: {
              mode: 'static',
              path: publicPath,
            },
          },
        },
      }));
    });

    afterAll(async () => {
      await cleanup();
      await cleanupTestFiles();
    });

    test('should interpolate variables in directly requested HTML', async () => {
      const res = await app.request('/test-interpolation.html');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain('<title>Test App</title>');
      expect(body).toContain('Hello Alice');
    });

    test('should interpolate variables in SPA fallback', async () => {
      const res = await app.request('/nonexistent-route');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain('<title>My App</title>');
    });

    test('should interpolate variables in directory index.html', async () => {
      const res = await app.request('/test-subdir');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain('<title>Test App</title>');
    });

    test('should serve non-HTML files with correct Content-Type', async () => {
      const res = await app.request('/test.svg');

      expect(res.status).toBe(200);
      const contentType = res.headers.get('content-type');
      expect(contentType).toContain('image/svg+xml');
    });

    test('should return 404 for API routes', async () => {
      const res = await app.request('/api/nonexistent');

      expect(res.status).toBe(404);
    });

    test('should not serve files outside public directory', async () => {
      // URL parsers normalize /../ to /, so the request
      // becomes /package.json which does not exist in
      // public/. The SPA fallback serves index.html
      // instead of leaking files outside public/.
      const res = await app.request('/../package.json');

      expect(res.status).toBe(200);
      const body = await res.text();
      // Should get the SPA fallback (index.html), not
      // the actual package.json from the parent dir
      expect(body).toContain('<title>My App</title>');
      expect(body).not.toContain('"name"');
    });

    test('should cache HTML and return identical content', async () => {
      const res1 = await app.request('/test-interpolation.html');
      const res2 = await app.request('/test-interpolation.html');

      const body1 = await res1.text();
      const body2 = await res2.text();
      expect(body1).toBe(body2);
    });
  });

  describe('without html_variables (empty)', () => {
    let app: AppType;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      await setupTestFiles();
      ({ app, cleanup } = await createApp({
        config: {
          ...MINIMAL_TEST_CONFIG,
          app: {
            ...MINIMAL_TEST_CONFIG.app,
            frontend: {
              mode: 'static',
              path: publicPath,
            },
          },
        },
      }));
    });

    afterAll(async () => {
      await cleanup();
      await cleanupTestFiles();
    });

    test('should serve HTML with placeholders intact', async () => {
      const res = await app.request('/test-interpolation.html');

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('{{PAGE_TITLE}}');
      expect(body).toContain('{{USER_NAME}}');
    });

    test('should serve SPA fallback normally', async () => {
      const res = await app.request('/nonexistent-route');

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('<!doctype html>');
    });

    test('should not serve files outside public directory', async () => {
      const res = await app.request('/../package.json');

      expect(res.status).toBe(200);
      const body = await res.text();
      // Should get the SPA fallback, not the real
      // package.json from the parent directory
      expect(body).toContain('<!doctype html>');
      expect(body).not.toContain('"name"');
    });
  });
});
