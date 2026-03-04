import { Hono } from 'hono';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CloudflareExampleEnv } from './config.js';
import { resolveCloudflareExampleConfig } from './config.js';

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
  return vi.fn(async (input: RequestInfo | URL) => {
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
  });
}

function createEnv(
  overrides: Partial<Omit<CloudflareExampleEnv, 'ASSETS'>> = {},
): CloudflareExampleEnv {
  return {
    ASSETS: {
      fetch: createAssetsFetcher(),
    },
    APP_HOST: 'https://auth.example.com',
    COOKIE_SECRET:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    DATABASE_URL: 'postgres://postgres:postgres@db.example.com:5432/tinyauth',
    HTML_TITLE: 'Example Auth',
    HTML_DESCRIPTION: 'Example Description',
    HTML_FAVICON_URL: '/vite.svg',
    ...overrides,
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

describe('resolveCloudflareExampleConfig', () => {
  test('parses postgres config and applies worker defaults', async () => {
    const config = await resolveCloudflareExampleConfig(createEnv());

    expect(config.app.host).toBe('https://auth.example.com');
    expect(config.app.allowed_signup_emails).toEqual(['*']);
    expect(config.database).toEqual({
      type: 'postgres',
      host: 'db.example.com',
      port: 5432,
      user: 'postgres',
      password: 'postgres',
      name: 'tinyauth',
    });
    expect(config.scheduler.enabled).toBe(false);
    expect(config.smtp).toBeUndefined();
  });

  test('parses ALLOWED_SIGNUP_EMAILS and JSON arrays', async () => {
    const config = await resolveCloudflareExampleConfig(
      createEnv({
        ALLOWED_SIGNUP_EMAILS: 'admin@example.com, *@example.com',
        CLIENTS_JSON:
          '[{"id":"app","name":"App","client_id":"client","client_secret":"secret","redirect_uris":["https://app.example.com/callback"],"response_types":["code"],"grant_types":["authorization_code","refresh_token"],"scope":"openid profile email"}]',
        USERS_JSON:
          '[{"sub":"user-1","email":"admin@example.com","password":"Password1234!","role":"admin"}]',
      }),
    );

    expect(config.app.allowed_signup_emails).toEqual([
      'admin@example.com',
      '*@example.com',
    ]);
    expect(config.clients).toHaveLength(1);
    expect(config.users).toHaveLength(1);
  });
});

describe('createCloudflareExampleApp', () => {
  test('preserves backend routes', async () => {
    const { createCloudflareExampleApp } = await import('./app.js');
    const env = createEnv();
    const app = await createCloudflareExampleApp(env);

    const response = await app.fetch(
      new Request('https://auth.example.com/api/health/live'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  test('returns json 404 for unknown backend routes', async () => {
    const { createCloudflareExampleApp } = await import('./app.js');
    const env = createEnv();
    const app = await createCloudflareExampleApp(env);

    const response = await app.fetch(
      new Request('https://auth.example.com/api/unknown'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not Found' });
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  test('serves interpolated frontend html for app routes', async () => {
    const { createCloudflareExampleApp } = await import('./app.js');
    const env = createEnv();
    const app = await createCloudflareExampleApp(env);

    const response = await app.fetch(
      new Request('https://auth.example.com/login'),
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Example Auth');
    expect(html).toContain('Example Description');
    expect(html).not.toContain('{{TITLE}}');
  });

  test('does not return spa html for missing file-like requests', async () => {
    const { createCloudflareExampleApp } = await import('./app.js');
    const env = createEnv();
    const app = await createCloudflareExampleApp(env);

    const response = await app.fetch(
      new Request('https://auth.example.com/missing.js'),
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Not Found');
  });
});
