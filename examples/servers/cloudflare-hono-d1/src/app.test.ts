import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { createAppMock } = vi.hoisted(() => {
  return {
    createAppMock: vi.fn(),
  };
});

vi.mock('@tinyrack/tinyauth-server', () => {
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
  vi.resetModules();
  createAppMock.mockReset();
  createAppMock.mockImplementation(
    async (options: {
      frontend?: (runtime: {
        branding?: unknown;
        server?: unknown;
      }) => (c: import('hono').Context) => Response | Promise<Response>;
    }) => {
      const app = new Hono();
      app.get('/api/health/live', (c) => {
        return c.json({ status: 'ok' });
      });

      const frontendHandler = options.frontend?.({});
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
    return {
      ASSETS: assets,
      DB: db,
      PUBLIC_ORIGIN: 'https://auth.example.com',
    };
  }

  test('preserves backend routes', async () => {
    const worker = (await import('./index.ts')).default;
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

  test('initializes TinyAuth once per worker isolate', async () => {
    const worker = (await import('./index.ts')).default;
    const env = createEnv();

    await worker.fetch(
      new Request('https://auth.example.com/api/health/live'),
      env,
      {} as never,
    );
    await worker.fetch(
      new Request('https://auth.example.com/api/health/live'),
      env,
      {} as never,
    );

    expect(createAppMock).toHaveBeenCalledOnce();
  });

  test('shares in-flight TinyAuth initialization across concurrent requests', async () => {
    const worker = (await import('./index.ts')).default;
    const env = createEnv();

    await Promise.all([
      worker.fetch(
        new Request('https://auth.example.com/api/health/live'),
        env,
        {} as never,
      ),
      worker.fetch(
        new Request('https://auth.example.com/login'),
        env,
        {} as never,
      ),
    ]);

    expect(createAppMock).toHaveBeenCalledOnce();
  });

  test('retries TinyAuth initialization after a failure', async () => {
    createAppMock.mockRejectedValueOnce(new Error('init failed'));
    const worker = (await import('./index.ts')).default;
    const env = createEnv();

    await expect(
      worker.fetch(
        new Request('https://auth.example.com/api/health/live'),
        env,
        {} as never,
      ),
    ).rejects.toThrow('init failed');

    const response = await worker.fetch(
      new Request('https://auth.example.com/api/health/live'),
      env,
      {} as never,
    );

    expect(response.status).toBe(200);
    expect(createAppMock).toHaveBeenCalledTimes(2);
  });

  test('uses configured public origin when building TinyAuth options', async () => {
    const worker = (await import('./index.ts')).default;
    const env = createEnv();

    await worker.fetch(
      new Request('https://preview.example.net/api/health/live'),
      env,
      {} as never,
    );

    expect(createAppMock).toHaveBeenCalledWith(
      expect.objectContaining({
        server: { public_origin: 'https://auth.example.com' },
      }),
    );
  });

  test('does not configure Wrangler-owned D1 migrations', () => {
    const wranglerConfig = readFileSync(
      new URL('../wrangler.jsonc', import.meta.url),
      'utf8',
    );

    expect(wranglerConfig).not.toContain('"migrations_dir"');
  });

  test('delegates unknown backend routes to frontend handler', async () => {
    const worker = (await import('./index.ts')).default;
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
    const worker = (await import('./index.ts')).default;
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
    const worker = (await import('./index.ts')).default;
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
