import {
  type AppConfigInput,
  resolveConfig,
} from '@backend/lib/config/index.js';
import { env } from '@backend/lib/env.js';
import { interpolateHtml } from '@backend/lib/interpolate-html.js';
import { isBackendRoute } from '@backend/lib/is-backend-route.js';
import { createLogger } from '@backend/lib/logger.js';
import { OPENAPI_DOCUMENTATION } from '@backend/lib/openapi.js';
import { loggerMiddleware } from '@backend/middleware/logger.js';
import { mikroOrmMiddleware } from '@backend/middleware/mikro-orm.js';
import { createProxyHandler } from '@backend/middleware/proxy.js';
import { servicesMiddleware } from '@backend/middleware/services.js';
import { sessionMiddleware } from '@backend/middleware/session.js';
import { registerProdStatic } from '@backend/middleware/static.js';
import { trustedProxyGuard } from '@backend/middleware/trusted-proxy-guard.js';
import { routes } from '@backend/routes/index.js';
import { e, TinyAuthError } from '@backend/schemas/error.js';
import { initializeServices } from '@backend/services/container.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateSpecs } from 'hono-openapi';

export type { AppConfigInput };

export interface CreateAppOptions {
  /**
   * Application configuration in external format.
   * This will be resolved to internal format with
   * all defaults applied.
   * Only `app.cookie_secret` is required - all other
   * fields have defaults.
   */
  config: AppConfigInput;
}

export async function createApp(options: CreateAppOptions) {
  // Resolve external config to internal config
  // with all defaults applied
  const config = await resolveConfig(options.config);

  // Create root logger (use config.logging.level: 'silent' to suppress)
  const logger = createLogger({ logging: config.logging });

  // Initialize all services (DB, mail, scheduler, etc.)
  const { services, cleanup } = await initializeServices(config, logger);

  const app = new Hono()
    .onError((err, c) => {
      if (err instanceof TinyAuthError) {
        return c.json(err.toJson(), err.status);
      }

      logger.error({ err }, 'Unhandled error');
      const internalErr = new e.InternalServerError.Error();
      return c.json(internalErr.toJson(), internalErr.status);
    })
    .use(
      '*',
      loggerMiddleware(logger, {
        httpLogProxy: config.logging.http_log_proxy,
      }),
    )
    .use(
      '*',
      cors({
        origin: env.APP_ENV === 'development' ? '*' : config.app.host,
        credentials: true,
      }),
    )
    .use(
      '*',
      sessionMiddleware(
        config.app.cookie_secret,
        config.app.host.startsWith('https'),
      ),
    )
    .use('*', trustedProxyGuard(config.app.trust_proxy))
    .use('*', servicesMiddleware(services))
    .use('*', mikroOrmMiddleware)
    .route('/', routes);

  app.get('/api/docs/json', async (c) => {
    const spec = await generateSpecs(app, {
      documentation: OPENAPI_DOCUMENTATION,
    });

    return c.json(spec);
  });

  // Register frontend handler based on config
  const { frontend } = config.app;

  if (!frontend.enabled) {
    logger.info('Frontend disabled (frontend.enabled = false)');
    app.notFound((c) => c.json({ error: 'Not Found' }, 404));
  } else if (frontend.mode === 'proxy') {
    const variables = config.app.html_variables;
    const hasVariables = Object.keys(variables).length > 0;

    const proxyHandler = createProxyHandler({
      upstream: frontend.path,
      logger,
      onResponse: hasVariables
        ? async (res) => {
            const ct = res.headers.get('content-type') ?? '';
            if (!ct.includes('text/html')) {
              return res;
            }
            const raw = await res.text();
            const interpolated = interpolateHtml(raw, variables);
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
  } else {
    logger.info(
      { path: frontend.path },
      'Frontend handler registered (static mode)',
    );
    registerProdStatic(app, {
      htmlVariables: config.app.html_variables,
      publicPath: frontend.path,
    });
  }

  // Start scheduler
  services.scheduler.start();

  return { app, services, cleanup, logger };
}

export type AppType = Awaited<ReturnType<typeof createApp>>['app'];
