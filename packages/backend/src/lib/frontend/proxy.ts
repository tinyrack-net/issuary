import type { Context } from 'hono';
import { proxy } from 'hono/proxy';

import type { FrontendConfig } from '#backend/lib/config/frontend.js';

export interface CreateProxyHandlerOptions {
  /**
   * Upstream server URL to proxy requests to.
   * Example: 'http://localhost:8081'
   */
  upstream: string;
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
 * Create a FrontendConfig that proxies requests to an upstream server.
 */
export function createProxyHandler(
  options: CreateProxyHandlerOptions,
): FrontendConfig {
  return async (c: Context): Promise<Response> => {
    const reqUrl = new URL(c.req.url);
    const targetUrl = `${options.upstream}${reqUrl.pathname}${reqUrl.search}`;

    const res = await proxy(targetUrl, {
      raw: c.req.raw,
    });

    if (options.onResponse) {
      return options.onResponse(res);
    }

    return res;
  };
}
