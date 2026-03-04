import { createApp } from '@tinyauth/backend';
import { isBackendRoute } from '@tinyauth/backend/routing';
import {
  type CloudflareExampleEnv,
  getHtmlVariables,
  resolveCloudflareExampleConfig,
} from './config.js';
import { interpolateHtml } from './interpolate-html.js';

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

export async function createCloudflareExampleApp(env: CloudflareExampleEnv) {
  const config = await resolveCloudflareExampleConfig(env);
  const htmlVariables = getHtmlVariables(env);
  const result = await createApp({ config });

  result.app.notFound(async (c) => {
    const pathname = new URL(c.req.url).pathname;

    if (isBackendRoute(pathname)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const assetResponse = await env.ASSETS.fetch(c.req.raw);
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

    return interpolateHtmlResponse(assetResponse, htmlVariables);
  });

  return result.app;
}
