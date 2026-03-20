import type { FrontendConfig } from '#backend/lib/config/frontend.js';
import type { HtmlVariables } from '#backend/lib/interpolate-html.js';
import {
  interpolateHtmlResponse,
  resolveHtmlVariables,
} from '#backend/lib/interpolate-html.js';

export interface CloudflareAssetsBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface CreateCloudflareAssetsHandlerOptions {
  assets: CloudflareAssetsBinding;
  htmlVariables?: HtmlVariables | undefined;
  onResponse?:
    | ((response: Response) => Response | Promise<Response>)
    | undefined;
}

export function createCloudflareAssetsHandler(
  options: CreateCloudflareAssetsHandlerOptions,
): FrontendConfig {
  return ({ branding, server }) => {
    const htmlVariables = resolveHtmlVariables({
      branding,
      server,
      overrides: options.htmlVariables,
    });

    async function finalizeResponse(response: Response): Promise<Response> {
      if (options.onResponse) {
        return options.onResponse(response);
      }

      return response;
    }

    return async (c): Promise<Response> => {
      const pathname = new URL(c.req.url).pathname;
      const response = await options.assets.fetch(c.req.raw);
      const isHtml =
        response.headers
          .get('content-type')
          ?.toLowerCase()
          .includes('text/html') ?? false;

      if (
        pathname !== '/index.html' &&
        /\/[^/]+\.[^/]+$/.test(pathname) &&
        isHtml
      ) {
        return finalizeResponse(c.text('Not Found', 404));
      }

      if (c.req.method !== 'GET') {
        return finalizeResponse(response);
      }

      return finalizeResponse(
        await interpolateHtmlResponse(response, htmlVariables),
      );
    };
  };
}
