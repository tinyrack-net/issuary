import { type AppType, createApp } from '@tinyauth/backend';
import { sqlite } from '@tinyauth/backend/database/sqlite';

function isBackendRoute(urlPath: string): boolean {
  return (
    urlPath.startsWith('/api') ||
    urlPath.startsWith('/oauth') ||
    urlPath.startsWith('/.well-known')
  );
}

interface AssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher;
}

const HTML_VARIABLES: Record<string, string> = {
  TITLE: 'TinyAuth',
  DESCRIPTION: 'OIDC for everyone',
  FAVICON_URL: '/vite.svg',
};

function interpolateHtml(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/{{([A-Z0-9_]+)}}/g, (_match, rawKey: string) => {
    return variables[rawKey] ?? '';
  });
}

function isHtmlResponse(response: Response): boolean {
  return (
    response.headers.get('content-type')?.toLowerCase().includes('text/html') ??
    false
  );
}

function hasFileExtension(pathname: string): boolean {
  return /\/[^/]+\.[^/]+$/.test(pathname);
}

async function interpolateHtmlResponse(
  response: Response,
  variables: Record<string, string>,
): Promise<Response> {
  if (!isHtmlResponse(response)) {
    return response;
  }

  const interpolated = interpolateHtml(await response.text(), variables);
  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(interpolated, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function createCloudflareExampleApp(assets: AssetFetcher) {
  const result = await createApp({
    config: {
      app: {
        host: 'http://127.0.0.1:8787',
        port: 8787,
        cookie_secret:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        jwt_access_token_ttl: 3600,
        jwt_refresh_token_ttl: 2592000,
        jwt_key_rotation_enabled: true,
        jwt_key_rotation_days: 30,
        jwt_key_overlap_days: 7,
        allowed_signup_emails: ['*'],
        supported_languages: ['en', 'ko', 'ja'],
        default_language: 'auto',
        fallback_language: 'en',
        light_theme: 'light',
        dark_theme: 'dark',
        theme_mode: 'system',
        background_url:
          'https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&auto=format&fit=crop&q=80&w=2071',
        trust_proxy: false,
        signup_implicit_terms: {},
        title: { en: 'TinyAuth', ko: 'TinyAuth', ja: 'TinyAuth' },
        subtitle: {
          en: 'Lightweight identity provider for your apps',
          ko: '가볍고 빠른 인증 솔루션',
          ja: '軽量でシンプルな認証ソリューション',
        },
        account_deletion: false,
      },
      database: sqlite({
        path: './test.db',
        test: true,
      }),
      security: {
        hash_master_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
        pbkdf2_iterations: 600000,
      },
      logging: {
        level: 'info',
        format: 'json',
        http_log_proxy: false,
      },
      auth: {
        password: {
          enabled: true,
          email_verification: true,
          second_factor: { required: false },
          totp: { enabled: false, issuer: 'Tinyrack' },
          policy: { min_length: 12, max_length: 256 },
        },
        passkey: { enabled: false, email_verification: true },
      },
      cleanup: {
        revoked_tokens: { enabled: true, retention: '0' },
        oauth_codes: { enabled: true, consumed_retention: '24h' },
        email_verifications: { enabled: true, retention: '0' },
        password_resets: { enabled: true, retention: '0' },
        deleted_users: { enabled: true, retention: '30d' },
        pending_oauth_registrations: { enabled: true, retention: '0' },
        jwt_keys: { enabled: true },
      },
      scheduler: {
        enabled: false,
        cron: '0 2 * * *',
      },
      terms: [],
      clients: [],
      users: [],
      identity_providers: [],
    },
  });

  result.app.notFound(async (c) => {
    const pathname = new URL(c.req.url).pathname;

    if (isBackendRoute(pathname)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const assetResponse = await assets.fetch(c.req.raw);
    if (
      pathname !== '/index.html' &&
      hasFileExtension(pathname) &&
      isHtmlResponse(assetResponse)
    ) {
      return c.text('Not Found', 404);
    }

    if (c.req.method !== 'GET') {
      return assetResponse;
    }

    return interpolateHtmlResponse(assetResponse, HTML_VARIABLES);
  });

  return result.app;
}

type AppExecutionContext = Parameters<AppType['fetch']>[2];

const worker = {
  async fetch(
    request: Request,
    env: Env,
    executionContext: AppExecutionContext,
  ) {
    const app = await createCloudflareExampleApp(env.ASSETS);
    return app.fetch(request, env, executionContext);
  },
};

export default worker;
