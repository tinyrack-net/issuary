import { proxy } from 'hono/proxy';

import type { FrontendConfig } from '#backend/lib/config/frontend.js';
import type { HtmlVariables } from '#backend/lib/interpolate-html.js';
import {
  interpolateHtmlResponse,
  resolveHtmlVariables,
} from '#backend/lib/interpolate-html.js';

export interface CreateProxyHandlerOptions {
  /**
   * Upstream server URL to proxy requests to.
   * Example: 'http://localhost:8081'
   */
  upstream: string;
  /**
   * HTML variable map for `{{VAR}}` interpolation in HTML responses.
   */
  htmlVariables?: HtmlVariables | undefined;
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
  return ({ branding, server }) => {
    const htmlVariables = resolveHtmlVariables({
      branding,
      server,
      overrides: options.htmlVariables,
    });

    function buildTargetUrl(requestUrl: string): string {
      const upstreamUrl = new URL(options.upstream);
      const incomingUrl = new URL(requestUrl);
      const upstreamPath = upstreamUrl.pathname.endsWith('/')
        ? upstreamUrl.pathname.slice(0, -1)
        : upstreamUrl.pathname;

      upstreamUrl.pathname = `${upstreamPath}${incomingUrl.pathname}`;
      upstreamUrl.search = incomingUrl.search;

      return upstreamUrl.toString();
    }

    async function finalizeResponse(response: Response): Promise<Response> {
      const interpolated = await interpolateHtmlResponse(
        response,
        htmlVariables,
      );

      if (options.onResponse) {
        return options.onResponse(interpolated);
      }

      return interpolated;
    }

    return async (c): Promise<Response> => {
      const response = await proxy(buildTargetUrl(c.req.url), {
        raw: c.req.raw,
      });

      return finalizeResponse(response);
    };
  };
}
