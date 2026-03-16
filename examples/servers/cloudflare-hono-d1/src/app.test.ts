import type { Context } from 'hono';
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

function createMockD1Database() {
  return {} as D1Database;
}

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
  createAppMock.mockImplementation(
    async (options: {
      frontend?: (c: Context) => Response | Promise<Response>;
    }) => {
      const app = new Hono();
      app.get('/api/health/live', (c) => {
        return c.json({ status: 'ok' });
      });

      const frontendHandler = options.frontend;
      app.notFound(async (c) => {
        if (frontendHandler) {
          return frontendHandler(c);
        }
        return c.json({ error: 'Not Found' }, 404);
      });

      return { app };
    },
  );
});

describe('cloudflare worker', () => {
  function createEnv(
    assets = createAssetsFetcher(),
    db = createMockD1Database(),
  ) {
    return { ASSETS: assets, DB: db };
  }

  test('preserves backend routes', async () => {
    const worker = (await import('./index.js')).default;
    const env = createEnv();

    const response = await worker.fetch(
      new Request('https://auth.example.com/api/health/live'),
      env,
      {} as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  test('delegates unknown backend routes to frontend handler', async () => {
    const worker = (await import('./index.js')).default;
    const env = createEnv();

    const response = await worker.fetch(
      new Request('https://auth.example.com/api/unknown'),
      env,
      {} as never,
    );

    expect(response.status).toBe(404);
    expect(env.ASSETS.fetch).toHaveBeenCalled();
  });

  test('serves interpolated frontend html for app routes', async () => {
    const worker = (await import('./index.js')).default;
    const env = createEnv();

    const response = await worker.fetch(
      new Request('https://auth.example.com/login'),
      env,
      {} as never,
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('TinyAuth');
    expect(html).toContain('OIDC for everyone');
    expect(html).not.toContain('{{TITLE}}');
  });

  test('does not return spa html for missing file-like requests', async () => {
    const worker = (await import('./index.js')).default;
    const env = createEnv();

    const response = await worker.fetch(
      new Request('https://auth.example.com/missing.js'),
      env,
      {} as never,
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Not Found');
  });
});
