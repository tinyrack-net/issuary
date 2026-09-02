import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context } from 'hono';
import { getMimeType } from 'hono/utils/mime';
import {
  createRequestHandler,
  RouterContextProvider,
  type ServerBuild,
} from 'react-router';
import { frontendRuntimeContext } from './runtime-context.js';

export type ReactRouterRuntimeOptions = {
  loadServerBuild: () => Promise<ServerBuild>;
};

export type ReactRouterFrontendHandler = (
  context: Context,
  internalFetch: typeof fetch,
) => Promise<Response>;

const frontendDirectory = fileURLToPath(
  new URL('../../../frontend/', import.meta.url),
);
const clientDirectory = path.join(frontendDirectory, 'client');
const serverBuildUrl = new URL(
  '../../../frontend/server/index.js',
  import.meta.url,
).href;

function clientAssetPath(urlPath: string): string | undefined {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return undefined;
  }
  const relativePath = decodedPath.replace(/^\/+/, '');
  const absolutePath = path.resolve(clientDirectory, relativePath);
  if (
    absolutePath !== clientDirectory &&
    !absolutePath.startsWith(`${clientDirectory}${path.sep}`)
  ) {
    return undefined;
  }
  return absolutePath;
}

async function serveClientAsset(
  context: Context,
  absolutePath: string,
): Promise<Response | undefined> {
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(absolutePath);
  } catch {
    return undefined;
  }
  if (!stats.isFile()) return undefined;

  const headers = new Headers({
    'Cache-Control': context.req.path.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600',
    'Content-Length': String(stats.size),
    'Content-Type': getMimeType(absolutePath) ?? 'application/octet-stream',
  });
  if (context.req.method === 'HEAD') {
    return new Response(null, { headers });
  }
  return new Response(await fs.promises.readFile(absolutePath), { headers });
}

export function createReactRouterFrontendHandler(
  options?: ReactRouterRuntimeOptions | undefined,
): ReactRouterFrontendHandler {
  const mode =
    process.env['NODE_ENV'] === 'production' ? 'production' : 'development';
  const requestHandler = createRequestHandler(
    options?.loadServerBuild ??
      (() => import(/* @vite-ignore */ serverBuildUrl)),
    mode,
  );
  const serveBuiltClientAssets = options === undefined;

  return async (context, internalFetch) => {
    if (
      serveBuiltClientAssets &&
      (context.req.method === 'GET' || context.req.method === 'HEAD')
    ) {
      const absolutePath = clientAssetPath(context.req.path);
      if (absolutePath !== undefined) {
        const assetResponse = await serveClientAsset(context, absolutePath);
        if (assetResponse !== undefined) return assetResponse;
      }
      if (context.req.path === '/favicon.ico') {
        return new Response(null, {
          headers: { 'Cache-Control': 'public, max-age=3600' },
          status: 404,
        });
      }
    }

    const requestContext = new RouterContextProvider();
    requestContext.set(frontendRuntimeContext, {
      fetch: internalFetch,
      request: context.req.raw,
    });
    const response = await requestHandler(context.req.raw, requestContext);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  };
}
