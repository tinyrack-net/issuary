import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import type { ResolvedAppConfig } from '@/lib/config/index.js';
import { env } from '@/lib/env.js';
import { interpolateHtml } from '@/lib/interpolate-html.js';
import type { AppType } from '@/types.js';

/**
 * HTTP status codes whose responses must NOT contain
 * a body per the Fetch API / HTTP specification.
 * Creating a `new Response(body, { status })` with a
 * non-null body for these codes throws a TypeError in
 * Node.js (undici).
 */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Default Vite dev server URL.
 */
const VITE_DEV_SERVER_URL = 'http://localhost:8081';

/**
 * Overridable upstream URL used by the dev proxy.
 * Exposed for testing so tests can point the proxy
 * at a mock server on a random port.
 */
let devProxyUpstreamUrl = VITE_DEV_SERVER_URL;

/**
 * Override the upstream URL the dev proxy connects to.
 * Only intended for test usage.
 */
export function setDevProxyUpstreamUrl(url: string): void {
  devProxyUpstreamUrl = url;
}

/**
 * Reset the upstream URL back to the default.
 */
export function resetDevProxyUpstreamUrl(): void {
  devProxyUpstreamUrl = VITE_DEV_SERVER_URL;
}

/**
 * Parse URL string to hostname and port.
 */
function parseUpstream(url: string): { hostname: string; port: number } {
  const parsed = new URL(url);
  return {
    hostname: parsed.hostname,
    port:
      Number.parseInt(parsed.port, 10) ||
      (parsed.protocol === 'https:' ? 443 : 80),
  };
}

/**
 * Check if a URL path is an API/backend route
 * that should return 404 instead of SPA fallback.
 */
function isBackendRoute(urlPath: string): boolean {
  return (
    urlPath.startsWith('/api') ||
    urlPath.startsWith('/application') ||
    urlPath.startsWith('/.well-known')
  );
}

/**
 * Register static file handling for the Hono app.
 *
 * - Production/test: serves from public/ with SPA
 *   fallback and HTML variable interpolation
 * - Development: proxies to Vite dev server with
 *   WebSocket upgrade support
 */
export function registerStaticHandler(
  app: AppType,
  config: ResolvedAppConfig,
  silent: boolean,
): void {
  if (env.APP_ENV === 'development') {
    registerDevProxy(app, config, silent);
  } else {
    registerProdStatic(app, config, silent);
  }
}

// -------------------------------------------------------
// Production / Test mode
// -------------------------------------------------------

function registerProdStatic(
  app: AppType,
  config: ResolvedAppConfig,
  silent: boolean,
): void {
  if (!silent) {
    console.info('Static handler registered (production mode)');
  }

  const publicPath = path.join(__dirname, '../../../public');
  const variables = config.app.html_variables;
  const hasVariables = Object.keys(variables).length > 0;

  /**
   * Lazy cache for interpolated HTML content.
   * Key: absolute file path, Value: interpolated HTML.
   * Only used when html_variables is configured.
   */
  const htmlCache = new Map<string, string>();

  /**
   * Read an HTML file, apply variable interpolation,
   * cache the result, and return the HTML string.
   */
  async function getInterpolatedHtml(absolutePath: string): Promise<string> {
    const cached = htmlCache.get(absolutePath);
    if (cached !== undefined) {
      return cached;
    }
    const raw = await fs.promises.readFile(absolutePath, 'utf-8');
    const result = interpolateHtml(raw, variables);
    htmlCache.set(absolutePath, result);
    return result;
  }

  // Serve static files when no html_variables
  if (!hasVariables) {
    app.use(
      '*',
      serveStatic({
        root: './public',
      }),
    );
  }

  // Not-found handler: SPA fallback with SSG support
  app.notFound(async (c) => {
    const url = c.req.path;

    // API routes should return 404 errors
    if (isBackendRoute(url)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    // Remove query string from URL
    const urlPath = url.split('?')[0] ?? '/';
    const filePath = path.join(publicPath, urlPath);

    // Try to serve the requested file (SSG support)
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isFile()) {
        if (hasVariables && filePath.endsWith('.html')) {
          const html = await getInterpolatedHtml(filePath);
          return c.html(html);
        }
        const content = await fs.promises.readFile(filePath);
        return new Response(content);
      }

      // If it's a directory, try index.html
      if (stats.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        try {
          await fs.promises.access(indexPath, fs.constants.F_OK);
          if (hasVariables) {
            const html = await getInterpolatedHtml(indexPath);
            return c.html(html);
          }
          const content = await fs.promises.readFile(indexPath);
          return c.html(content.toString('utf-8'));
        } catch {
          // No index.html in directory, fall through
        }
      }
    } catch {
      // File doesn't exist, fall through to SPA
    }

    // SPA fallback: serve root index.html
    const rootIndex = path.join(publicPath, 'index.html');
    if (hasVariables) {
      const html = await getInterpolatedHtml(rootIndex);
      return c.html(html);
    }
    try {
      const content = await fs.promises.readFile(rootIndex, 'utf-8');
      return c.html(content);
    } catch {
      return c.json({ error: 'Not Found' }, 404);
    }
  });
}

// -------------------------------------------------------
// Development mode (Vite proxy)
// -------------------------------------------------------

function registerDevProxy(
  app: AppType,
  config: ResolvedAppConfig,
  silent: boolean,
): void {
  if (!silent) {
    console.info(
      'Static handler registered (development mode, proxy: %s)',
      devProxyUpstreamUrl,
    );
  }

  const upstream = parseUpstream(devProxyUpstreamUrl);
  const variables = config.app.html_variables;
  const hasVariables = Object.keys(variables).length > 0;

  // Not-found handler: proxy to Vite dev server
  app.notFound((c) => {
    const reqUrl = new URL(c.req.url);
    const fullPath = reqUrl.pathname + reqUrl.search;

    // API routes should return 404 errors
    if (isBackendRoute(reqUrl.pathname)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    // Access Node.js IncomingMessage from env
    const incoming = (
      c.env as {
        incoming?: http.IncomingMessage;
      }
    )?.incoming;

    // Proxy HTTP request to Vite dev server
    return new Promise<Response>((resolve) => {
      const headers: Record<string, string> = {};
      if (incoming?.rawHeaders) {
        for (let i = 0; i < incoming.rawHeaders.length; i += 2) {
          const key = incoming.rawHeaders[i];
          const value = incoming.rawHeaders[i + 1];
          if (key && value) {
            headers[key] = value;
          }
        }
      }
      headers['host'] = `${upstream.hostname}:${upstream.port}`;

      const proxyReq = http.request(
        {
          hostname: upstream.hostname,
          port: upstream.port,
          path: fullPath,
          method: c.req.method,
          headers,
        },
        (proxyRes) => {
          const contentType = proxyRes.headers['content-type'] ?? '';
          const isHtml = contentType.includes('text/html');

          const statusCode = proxyRes.statusCode ?? 200;
          const isNullBody = NULL_BODY_STATUSES.has(statusCode);

          // Null-body responses (e.g. 304 Not Modified)
          // must not carry a body per the Fetch API spec.
          if (isNullBody) {
            // Drain the upstream so the socket is freed
            proxyRes.resume();
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(proxyRes.headers)) {
              if (key && value) {
                responseHeaders.set(
                  key,
                  Array.isArray(value) ? value.join(', ') : value,
                );
              }
            }
            resolve(
              new Response(null, {
                status: statusCode,
                ...(proxyRes.statusMessage
                  ? { statusText: proxyRes.statusMessage }
                  : {}),
                headers: responseHeaders,
              }),
            );
            return;
          }

          // Buffer HTML for variable interpolation
          if (hasVariables && isHtml) {
            const chunks: Buffer[] = [];
            proxyRes.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });
            proxyRes.on('end', () => {
              const raw = Buffer.concat(chunks).toString('utf-8');
              const interpolated = interpolateHtml(raw, variables);
              const responseHeaders = new Headers();
              for (const [key, value] of Object.entries(proxyRes.headers)) {
                if (key && value && key !== 'content-length') {
                  responseHeaders.set(
                    key,
                    Array.isArray(value) ? value.join(', ') : value,
                  );
                }
              }
              responseHeaders.set(
                'content-length',
                String(Buffer.byteLength(interpolated)),
              );
              resolve(
                new Response(interpolated, {
                  status: statusCode,
                  ...(proxyRes.statusMessage
                    ? { statusText: proxyRes.statusMessage }
                    : {}),
                  headers: responseHeaders,
                }),
              );
            });
            return;
          }

          // Stream non-HTML responses
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (key && value) {
              responseHeaders.set(
                key,
                Array.isArray(value) ? value.join(', ') : value,
              );
            }
          }

          const readable = new ReadableStream({
            start(controller) {
              proxyRes.on('data', (chunk: Buffer) => {
                controller.enqueue(chunk);
              });
              proxyRes.on('end', () => {
                controller.close();
              });
              proxyRes.on('error', (err) => {
                controller.error(err);
              });
            },
          });

          resolve(
            new Response(readable, {
              status: statusCode,
              ...(proxyRes.statusMessage
                ? { statusText: proxyRes.statusMessage }
                : {}),
              headers: responseHeaders,
            }),
          );
        },
      );

      proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        resolve(
          new Response(JSON.stringify({ error: 'Proxy error' }), {
            status: 502,
            headers: {
              'Content-Type': 'application/json',
            },
          }),
        );
      });

      // Pipe request body
      if (incoming?.readable) {
        incoming.pipe(proxyReq);
      } else {
        proxyReq.end();
      }
    });
  });
}
