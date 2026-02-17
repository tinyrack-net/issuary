import http from 'node:http';
import type { AppType } from '@backend/app.js';
import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import { interpolateHtml } from '@backend/lib/interpolate-html.js';

/**
 * HTTP status codes whose responses must NOT contain
 * a body per the Fetch API / HTTP specification.
 * Creating a `new Response(body, { status })` with a
 * non-null body for these codes throws a TypeError in
 * Node.js (undici).
 */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

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
    urlPath.startsWith('/oauth') ||
    urlPath.startsWith('/.well-known')
  );
}

/**
 * Register development proxy handler.
 *
 * Proxies unmatched requests to the Vite dev server
 * with WebSocket upgrade support.
 */
export function registerDevProxy(
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
