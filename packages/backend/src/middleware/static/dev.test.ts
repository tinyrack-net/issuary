import http from 'node:http';
import type { AppType } from '@backend/app.js';
import {
  resetDevProxyUpstreamUrl,
  setDevProxyUpstreamUrl,
} from '@backend/middleware/static/dev.js';
import { createServer } from '@backend/server.js';
import { MINIMAL_TEST_CONFIG } from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

/**
 * Spin up a tiny HTTP server that behaves like a Vite
 * dev server for the purposes of proxy testing.
 *
 * Routes:
 *   GET /          → 200 HTML
 *   GET /style.css → 200 CSS
 *   GET /304       → 304 Not Modified (no body)
 *   GET /204       → 204 No Content   (no body)
 *   *              → 404
 */
function createMockUpstream(): Promise<{
  server: http.Server;
  port: number;
}> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/';

      if (url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>dev index</body></html>');
        return;
      }

      if (url === '/style.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end('body { color: red }');
        return;
      }

      if (url === '/304') {
        res.writeHead(304, { etag: '"abc123"' });
        res.end();
        return;
      }

      if (url === '/204') {
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    // Listen on a random available port
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        resolve({ server, port: addr.port });
      }
    });
  });
}

// All routes tested here are handled by the dev proxy notFound handler and
// are NOT part of the typed OpenAPI route system, so we use app.request().
describe('static dev proxy', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;
  let upstream: http.Server;

  beforeAll(async () => {
    // Start mock upstream on a random port
    const result = await createMockUpstream();
    upstream = result.server;

    // Point the dev proxy at our mock upstream
    setDevProxyUpstreamUrl(`http://127.0.0.1:${String(result.port)}`);

    // Temporarily set APP_ENV to development so the
    // proxy path is activated.
    const envModule = await import('@backend/lib/env.js');
    (envModule.env as { APP_ENV: string }).APP_ENV = 'development';

    ({ app, cleanup } = await createServer({
      config: MINIMAL_TEST_CONFIG,
      skipListen: true,
      silent: true,
    }));
  });

  afterAll(async () => {
    // Restore APP_ENV
    const envModule = await import('@backend/lib/env.js');
    (envModule.env as { APP_ENV: string }).APP_ENV = 'test';

    // Reset upstream URL
    resetDevProxyUpstreamUrl();

    await cleanup();
    await new Promise<void>((resolve) => {
      upstream.close(() => {
        resolve();
      });
    });
  });

  test('proxies 200 HTML response', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('dev index');
  });

  test('proxies 200 CSS response', async () => {
    const res = await app.request('/style.css');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('body { color: red }');
  });

  test('handles 304 Not Modified without error', async () => {
    const res = await app.request('/304');
    expect(res.status).toBe(304);
    expect(res.headers.get('etag')).toBe('"abc123"');
    // 304 must have null body
    expect(res.body).toBeNull();
  });

  test('handles 204 No Content without error', async () => {
    const res = await app.request('/204');
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  test('returns 404 JSON for backend routes', async () => {
    const res = await app.request('/api/foo');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Not Found' });
  });

  test('proxies upstream 404 as-is', async () => {
    const res = await app.request('/nonexistent-upstream');
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toBe('Not Found');
  });
});
