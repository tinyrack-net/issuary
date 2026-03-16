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

  test('interpolates htmlVariables in HTML responses', async () => {
    proxyMock.mockResolvedValue(
      new Response('<html><head><title>{{APP_TITLE}}</title></head></html>', {
        headers: { 'content-type': 'text/html' },
        status: 200,
      }),
    );

    const app = createApp({
      htmlVariables: { APP_TITLE: 'My App' },
    });

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<title>My App</title>');
    expect(body).not.toContain('{{APP_TITLE}}');
  });

  test('does not interpolate htmlVariables in non-HTML responses', async () => {
    proxyMock.mockResolvedValue(
      new Response('body { content: "{{APP_TITLE}}" }', {
        headers: { 'content-type': 'text/css' },
        status: 200,
      }),
    );

    const app = createApp({
      htmlVariables: { APP_TITLE: 'My App' },
    });

    const res = await app.request('/style.css');
    const body = await res.text();
    expect(body).toContain('{{APP_TITLE}}');
  });

  test('applies default htmlVariables when none are provided', async () => {
    proxyMock.mockResolvedValue(
      new Response(
        '<html><head><title>{{TITLE}}</title><meta content="{{DESCRIPTION}}"><link href="{{FAVICON_URL}}"></head></html>',
        {
          headers: { 'content-type': 'text/html' },
          status: 200,
        },
      ),
    );

    const app = createApp();

    const res = await app.request('/');
    const body = await res.text();
    expect(body).toContain('<title>Tinyrack</title>');
    expect(body).toContain('content="OIDC Provider for everyone"');
    expect(body).toContain('href="/vite.svg"');
  });

  test('user htmlVariables override defaults', async () => {
    proxyMock.mockResolvedValue(
      new Response('<html><title>{{TITLE}}</title></html>', {
        headers: { 'content-type': 'text/html' },
        status: 200,
      }),
    );

    const app = createApp({
      htmlVariables: { TITLE: 'Custom Title' },
    });

    const res = await app.request('/');
    const body = await res.text();
    expect(body).toContain('<title>Custom Title</title>');
  });

  test('applies htmlVariables before onResponse', async () => {
    proxyMock.mockResolvedValue(
      new Response('<html><title>{{APP_TITLE}}</title></html>', {
        headers: { 'content-type': 'text/html' },
        status: 200,
      }),
    );

    const app = createApp({
      htmlVariables: { APP_TITLE: 'Original' },
      onResponse: async (res) => {
        const body = await res.text();
        return new Response(body.replace('Original', 'Overridden'), {
          headers: res.headers,
          status: res.status,
        });
      },
    });

    const res = await app.request('/');
    const body = await res.text();
    expect(body).toContain('Overridden');
    expect(body).not.toContain('Original');
    expect(body).not.toContain('{{APP_TITLE}}');
  });
});
