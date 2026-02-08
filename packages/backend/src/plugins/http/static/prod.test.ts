import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import { MINIMAL_TEST_CONFIG } from '@/test-utils/index.js';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

// Matches the path resolved by prod.ts: path.join(__dirname, '../../../public')
const publicPath = path.join(__dirname, '../../../public');

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

async function setupTestFiles(): Promise<void> {
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
  await fs.promises.rm(publicPath, {
    recursive: true,
    force: true,
  });
}

describe('static prod plugin - html_variables integration', () => {
  describe('with html_variables configured', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      await setupTestFiles();
      app = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          app: {
            ...MINIMAL_TEST_CONFIG.app,
            html_variables: {
              PAGE_TITLE: 'Test App',
              USER_NAME: 'Alice',
              APP_TITLE: 'My App',
            },
          },
        },
      });
    });

    afterAll(async () => {
      await app.close();
      await cleanupTestFiles();
    });

    test('should interpolate variables in directly requested HTML', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/test-interpolation.html',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain('<title>Test App</title>');
      expect(res.body).toContain('Hello Alice');
    });

    test('should interpolate variables in SPA fallback', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/nonexistent-route',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain('<title>My App</title>');
    });

    test('should interpolate variables in directory index.html', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/test-subdir',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain('<title>Test App</title>');
    });

    test('should serve non-HTML files without modification', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/test.svg',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).not.toContain('text/html');
    });

    test('should return 404 for API routes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/nonexistent',
      });

      expect(res.statusCode).toBe(404);
    });

    test('should cache HTML and return identical content', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: '/test-interpolation.html',
      });
      const res2 = await app.inject({
        method: 'GET',
        url: '/test-interpolation.html',
      });

      expect(res1.body).toBe(res2.body);
    });
  });

  describe('without html_variables (empty)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      await setupTestFiles();
      app = await createServer({
        config: MINIMAL_TEST_CONFIG,
      });
    });

    afterAll(async () => {
      await app.close();
      await cleanupTestFiles();
    });

    test('should serve HTML with placeholders intact', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/test-interpolation.html',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('{{PAGE_TITLE}}');
      expect(res.body).toContain('{{USER_NAME}}');
    });

    test('should serve SPA fallback normally', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/nonexistent-route',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('<!doctype html>');
    });
  });
});
