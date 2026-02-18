import http from 'node:http';
import { createLogger } from '@backend/lib/logger.js';
import { createProxyHandler } from '@backend/middleware/proxy.js';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

/**
 * Spin up a tiny HTTP server that behaves like an
 * upstream for the proxy handler.
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
        res.end('<html><body>upstream index</body></html>');
        return;
      }

      if (url.startsWith('/style.css')) {
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

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        resolve({ server, port: addr.port });
      }
    });
  });
}

describe('createProxyHandler', () => {
  let upstream: http.Server;
  let app: InstanceType<typeof Hono>;

  beforeAll(async () => {
    const result = await createMockUpstream();
    upstream = result.server;

    const handler = createProxyHandler({
      upstream: `http://127.0.0.1:${String(result.port)}`,
      logger: createLogger({ logging: { level: 'silent' } }),
    });

    app = new Hono();
    app.notFound((c) => handler(c));
  });

  afterAll(async () => {
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
    expect(body).toContain('upstream index');
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
    expect(res.body).toBeNull();
  });

  test('handles 204 No Content without error', async () => {
    const res = await app.request('/204');
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  test('proxies upstream 404 as-is', async () => {
    const res = await app.request('/nonexistent');
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toBe('Not Found');
  });

  test('preserves query string in proxied URL', async () => {
    const res = await app.request('/style.css?v=123');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('body { color: red }');
  });
});

describe('createProxyHandler with onResponse', () => {
  let upstream: http.Server;
  let app: InstanceType<typeof Hono>;

  beforeAll(async () => {
    const result = await createMockUpstream();
    upstream = result.server;

    const handler = createProxyHandler({
      upstream: `http://127.0.0.1:${String(result.port)}`,
      logger: createLogger({ logging: { level: 'silent' } }),
      onResponse: async (res) => {
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('text/html')) {
          return res;
        }
        const text = await res.text();
        const modified = text.replace('upstream index', 'modified index');
        return new Response(modified, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      },
    });

    app = new Hono();
    app.notFound((c) => handler(c));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      upstream.close(() => {
        resolve();
      });
    });
  });

  test('transforms HTML via onResponse hook', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('modified index');
    expect(body).not.toContain('upstream index');
  });

  test('passes non-HTML through unchanged', async () => {
    const res = await app.request('/style.css');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('body { color: red }');
  });
});
