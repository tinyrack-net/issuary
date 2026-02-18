import type { Logger } from '@backend/lib/logger.js';
import type { Context } from 'hono';
import { proxy } from 'hono/proxy';

export interface ProxyHandlerOptions {
  /**
   * Upstream server URL to proxy requests to.
   * Example: 'http://localhost:8081'
   */
  upstream: string;
  /**
   * Logger instance for proxy error reporting.
   */
  logger: Logger;
  /**
   * Optional response interceptor.
   * Called with the proxied Response before it is
   * returned. Return a modified Response or the
   * original as-is.
   */
  onResponse?:
    | ((response: Response) => Response | Promise<Response>)
    | undefined;
}

/**
 * Create a proxy handler that forwards requests to an
 * upstream server.
 *
 * Returns a plain async function `(c) => Response` that
 * can be used in `notFound`, `app.use()`, or any other
 * Hono handler position.
 *
 * @example
 * ```ts
 * const handler = createProxyHandler({
 *   upstream: 'http://localhost:8081',
 *   logger,
 * });
 * app.notFound((c) => handler(c));
 * ```
 */
export function createProxyHandler(options: ProxyHandlerOptions) {
  return async (c: Context): Promise<Response> => {
    const reqUrl = new URL(c.req.url);
    const targetUrl = `${options.upstream}${reqUrl.pathname}${reqUrl.search}`;

    try {
      const res = await proxy(targetUrl, {
        raw: c.req.raw,
      });

      if (options.onResponse) {
        return options.onResponse(res);
      }

      return res;
    } catch (err) {
      options.logger.error({ err }, 'Proxy error');
      return c.json({ error: 'Proxy error' }, 502);
    }
  };
}
