import type { AppType } from '@tinyauth/backend';
import type { Logger } from '@tinyauth/backend/logger';
import { isBackendRoute } from '@tinyauth/backend/routing';
import type { ResolvedStandaloneFrontendConfig } from '#standalone/lib/config/schema.js';
import { interpolateHtml } from './interpolate-html.js';
import { createProxyHandler } from './proxy.js';
import { registerStaticRoutes } from './static.js';

export interface RegisterFrontendRoutesOptions {
  frontend: ResolvedStandaloneFrontendConfig;
  htmlVariables: Record<string, string>;
  logger: Logger;
}

export function registerFrontendRoutes(
  app: AppType,
  options: RegisterFrontendRoutesOptions,
): void {
  const { frontend, htmlVariables, logger } = options;

  if (!frontend.enabled) {
    logger.info('Frontend disabled (frontend.enabled = false)');
    return;
  }

  if (frontend.mode === 'proxy') {
    const hasVariables = Object.keys(htmlVariables).length > 0;

    const proxyHandler = createProxyHandler({
      upstream: frontend.path,
      logger,
      onResponse: hasVariables
        ? async (res) => {
            const contentType = res.headers.get('content-type') ?? '';
            if (!contentType.includes('text/html')) {
              return res;
            }
            const raw = await res.text();
            const interpolated = interpolateHtml(raw, htmlVariables);
            const headers = new Headers(res.headers);
            headers.set(
              'content-length',
              String(new TextEncoder().encode(interpolated).byteLength),
            );
            return new Response(interpolated, {
              status: res.status,
              statusText: res.statusText,
              headers,
            });
          }
        : undefined,
    });

    logger.info(
      { proxy: frontend.path },
      'Frontend handler registered (proxy mode)',
    );

    app.notFound(async (c) => {
      const reqUrl = new URL(c.req.url);
      if (isBackendRoute(reqUrl.pathname)) {
        return c.json({ error: 'Not Found' }, 404);
      }
      return proxyHandler(c);
    });
    return;
  }

  logger.info(
    { path: frontend.path },
    'Frontend handler registered (static mode)',
  );
  registerStaticRoutes(app, {
    htmlVariables,
    publicPath: frontend.path,
  });
}
