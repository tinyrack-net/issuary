import { Hono } from 'hono';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { createAppMock } = vi.hoisted(() => {
  return {
    createAppMock: vi.fn(),
  };
});

vi.mock('@tinyauth/backend', () => {
  return {
    createApp: createAppMock,
  };
});

function createAssetsFetcher() {
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

beforeEach(() => {
  createAppMock.mockReset();
  createAppMock.mockImplementation(async () => {
    const app = new Hono();
    app.get('/api/health/live', (c) => {
      return c.json({ status: 'ok' });
    });
    return { app };
  });
});

describe('createCloudflareExampleApp', () => {
  test('preserves backend routes', async () => {
    const { createCloudflareExampleApp } = await import('./index.js');
    const assets = createAssetsFetcher();
    const app = await createCloudflareExampleApp(assets);

    const response = await app.fetch(
      new Request('https://auth.example.com/api/health/live'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  test('returns json 404 for unknown backend routes', async () => {
    const { createCloudflareExampleApp } = await import('./index.js');
    const assets = createAssetsFetcher();
    const app = await createCloudflareExampleApp(assets);

    const response = await app.fetch(
      new Request('https://auth.example.com/api/unknown'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not Found' });
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  test('serves interpolated frontend html for app routes', async () => {
    const { createCloudflareExampleApp } = await import('./index.js');
    const assets = createAssetsFetcher();
    const app = await createCloudflareExampleApp(assets);

    const response = await app.fetch(
      new Request('https://auth.example.com/login'),
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('TinyAuth');
    expect(html).toContain('OIDC for everyone');
    expect(html).not.toContain('{{TITLE}}');
  });

  test('does not return spa html for missing file-like requests', async () => {
    const { createCloudflareExampleApp } = await import('./index.js');
    const assets = createAssetsFetcher();
    const app = await createCloudflareExampleApp(assets);

    const response = await app.fetch(
      new Request('https://auth.example.com/missing.js'),
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Not Found');
  });
});
