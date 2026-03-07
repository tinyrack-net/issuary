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
        cookie_secret:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      database: sqlite({
        path: './test.db',
        test: true,
      }),
      security: {
        hash_master_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      },
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
