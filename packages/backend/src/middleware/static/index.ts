import type { AppType } from '@backend/lib/app.js';
import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import { env } from '@backend/lib/env.js';
import { registerDevProxy } from './dev.js';
import { registerProdStatic } from './prod.js';

export {
  resetDevProxyUpstreamUrl,
  setDevProxyUpstreamUrl,
} from './dev.js';

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
