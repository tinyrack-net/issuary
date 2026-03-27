import { Hono } from 'hono';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  type CloudflareAssetsBinding,
  createCloudflareAssetsHandler,
} from './cloudflare.ts';

function createAssetsFetcher(): CloudflareAssetsBinding {
  return {
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      const request =
        input instanceof Request
          ? input
          : new Request(input instanceof URL ? input : String(input));
      const pathname = new URL(request.url).pathname;

      if (
        pathname === '/' ||
        pathname === '/index.html' ||
        pathname === '/login'
      ) {
        return new Response(
          '<html><head><title>{{TITLE}}</title><meta name="description" content="{{DESCRIPTION}}" /></head><body>app</body></html>',
          {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
          },
        );
      }

      if (pathname === '/vite.svg') {
        return new Response('<svg />', {
          status: 200,
          headers: {
            'content-type': 'image/svg+xml',
          },
        });
      }

      if (pathname === '/missing.js') {
        return new Response('<html>fallback</html>', {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        });
      }

      return new Response('Not Found', { status: 404 });
    }),
  };
}

function createApp(assets = createAssetsFetcher()) {
  const handler = createCloudflareAssetsHandler({
    assets,
    htmlVariables: {
      TITLE: 'TinyAuth',
      DESCRIPTION: 'OIDC for everyone',
      FAVICON_URL: '/vite.svg',
    },
  })({});

  const app = new Hono();
  app.notFound((c) => handler(c));
  return { app, assets };
}

describe('createCloudflareAssetsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('serves interpolated frontend html for app routes', async () => {
    const { app } = createApp();

    const response = await app.request('https://auth.example.com/login');

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('TinyAuth');
    expect(html).toContain('OIDC for everyone');
    expect(html).not.toContain('{{TITLE}}');
  });

  test('does not return spa html for missing file-like requests', async () => {
    const { app } = createApp();

    const response = await app.request('https://auth.example.com/missing.js');

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Not Found');
  });

  test('passes through non-html assets unchanged', async () => {
    const { app } = createApp();

    const response = await app.request('https://auth.example.com/vite.svg');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/svg+xml');
    await expect(response.text()).resolves.toBe('<svg />');
  });

  test('passes through non-get requests without interpolation', async () => {
    const { app } = createApp();

    const response = await app.request('https://auth.example.com/login', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('{{TITLE}}');
  });

  test('applies onResponse after interpolation', async () => {
    const assets = createAssetsFetcher();
    const handler = createCloudflareAssetsHandler({
      assets,
      htmlVariables: {
        TITLE: 'Before Hook',
      },
      onResponse: async (response) => {
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('text/html')) {
          return response;
        }

        const body = await response.text();
        return new Response(body.replace('Before Hook', 'After Hook'), {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        });
      },
    })({});
    const app = new Hono();
    app.notFound((c) => handler(c));

    const response = await app.request('https://auth.example.com/login');

    const html = await response.text();
    expect(html).toContain('After Hook');
    expect(html).not.toContain('Before Hook');
    expect(html).not.toContain('{{TITLE}}');
  });
});
