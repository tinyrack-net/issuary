import { Hono } from 'hono';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { proxyMock } = vi.hoisted(() => ({
  proxyMock: vi.fn(),
}));

vi.mock('hono/proxy', () => ({
  proxy: proxyMock,
}));

import { type CreateProxyHandlerOptions, createProxyHandler } from './proxy.js';

function createApp(options?: Omit<CreateProxyHandlerOptions, 'upstream'>) {
  const handler = createProxyHandler({
    upstream: 'https://frontend.test',
    ...options,
  });

  const app = new Hono();
  app.notFound((c) => handler(c));
  return app;
}

describe('createProxyHandler', () => {
  beforeEach(() => {
    proxyMock.mockReset();
  });

  test('proxies the request to the upstream URL and preserves the query string', async () => {
    proxyMock.mockResolvedValue(
      new Response('<html><body>upstream index</body></html>', {
        headers: { 'content-type': 'text/html' },
        status: 200,
      }),
    );

    const app = createApp();
    const req = new Request('https://auth.test/login?client_id=abc&state=xyz', {
      headers: { cookie: 'session=123' },
    });
    const res = await app.request(req);

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain('upstream index');
    expect(proxyMock).toHaveBeenCalledTimes(1);
    expect(proxyMock).toHaveBeenCalledWith(
      'https://frontend.test/login?client_id=abc&state=xyz',
      expect.objectContaining({
        raw: req,
      }),
    );
  });

  test('passes 204 and 304 responses through unchanged', async () => {
    proxyMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 304,
          headers: { etag: '"abc123"' },
        }),
      );

    const app = createApp();

    const noContent = await app.request('/empty');
    expect(noContent.status).toBe(204);
    expect(noContent.body).toBeNull();

    const notModified = await app.request('/cached');
    expect(notModified.status).toBe(304);
    expect(notModified.headers.get('etag')).toBe('"abc123"');
    expect(notModified.body).toBeNull();
  });

  test('applies onResponse only to the proxied response', async () => {
    proxyMock
      .mockResolvedValueOnce(
        new Response('<html><body>upstream index</body></html>', {
          headers: { 'content-type': 'text/html' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response('body { color: red }', {
          headers: { 'content-type': 'text/css' },
          status: 200,
        }),
      );

    const app = createApp({
      onResponse: async (res) => {
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('text/html')) {
          return res;
        }

        const body = await res.text();
        return new Response(body.replace('upstream', 'modified'), {
          headers: res.headers,
          status: res.status,
          statusText: res.statusText,
        });
      },
    });

    const html = await app.request('/');
    await expect(html.text()).resolves.toContain('modified index');

    const css = await app.request('/style.css');
    await expect(css.text()).resolves.toContain('body { color: red }');
  });
});
