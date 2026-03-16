import type { Context } from 'hono';
import { proxy } from 'hono/proxy';

import type { FrontendConfig } from '#backend/lib/config/frontend.js';
import {
  DEFAULT_HTML_VARIABLES,
  interpolateHtmlResponse,
} from '#backend/lib/interpolate-html.js';

export interface CreateProxyHandlerOptions {
  /**
   * Upstream server URL to proxy requests to.
   * Example: 'http://localhost:8081'
   */
  upstream: string;
  /**
   * HTML variable map for `{{VAR}}` interpolation in HTML responses.
   * Non-HTML responses are passed through unchanged.
   */
  htmlVariables?: Record<string, string> | undefined;
  /**
   * Optional response interceptor.
   * Called with the (already-interpolated) Response before it is
   * returned. Return a modified Response or the original as-is.
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
  const htmlVariables = {
    ...DEFAULT_HTML_VARIABLES,
    ...options.htmlVariables,
  };
  const hasVariables = Object.keys(htmlVariables).length > 0;

  return async (c: Context): Promise<Response> => {
    const reqUrl = new URL(c.req.url);
    const targetUrl = `${options.upstream}${reqUrl.pathname}${reqUrl.search}`;

    let res = await proxy(targetUrl, {
      raw: c.req.raw,
    });

    if (hasVariables) {
      res = await interpolateHtmlResponse(res, htmlVariables);
    }

    if (options.onResponse) {
      return options.onResponse(res);
    }

    return res;
  };
}
