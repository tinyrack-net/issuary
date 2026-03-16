import { type AppType, createApp } from '@tinyauth/backend';
import { d1 } from '@tinyauth/backend/database/d1';
import {
  type FrontendConfig,
  interpolateHtmlResponse,
} from '@tinyauth/backend/frontend';

interface AssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher;
  DB: D1Database;
}

const HTML_VARIABLES: Record<string, string> = {
  TITLE: 'TinyAuth',
  DESCRIPTION: 'OIDC for everyone',
  FAVICON_URL: '/vite.svg',
};

function hasFileExtension(pathname: string): boolean {
  return /\/[^/]+\.[^/]+$/.test(pathname);
}

function isHtmlResponse(response: Response): boolean {
  return (
    response.headers.get('content-type')?.toLowerCase().includes('text/html') ??
    false
  );
}

function createAssetsHandler(assets: AssetFetcher): FrontendConfig {
  return async (c) => {
    const pathname = new URL(c.req.url).pathname;
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
  };
}

export async function createCloudflareExampleApp(
  assets: AssetFetcher,
  db: D1Database,
) {
  const result = await createApp({
    database: d1({ database: db }),
    security: {
      session_secret:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    },
    frontend: createAssetsHandler(assets),
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
    const app = await createCloudflareExampleApp(env.ASSETS, env.DB);
    return app.fetch(request, env, executionContext);
  },
};

export default worker;
