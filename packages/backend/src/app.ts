import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateSpecs } from 'hono-openapi';
import type { ResolvedAppConfig } from '#backend/lib/config/index.js';
import { createLogger } from '#backend/lib/logger.js';
import { OPENAPI_DOCUMENTATION } from '#backend/lib/openapi.js';
import { loggerMiddleware } from '#backend/middleware/logger.js';
import { mikroOrmMiddleware } from '#backend/middleware/mikro-orm.js';
import { servicesMiddleware } from '#backend/middleware/services.js';
import { sessionMiddleware } from '#backend/middleware/session.js';
import { trustedProxyGuard } from '#backend/middleware/trusted-proxy-guard.js';
import { routes } from '#backend/routes/index.js';
import { e, TinyAuthError } from '#backend/schemas/error.js';
import { initializeServices } from '#backend/services/container.js';

export interface CreateAppOptions {
  /**
   * Application configuration for the backend runtime.
   */
  config: ResolvedAppConfig;
}

export async function createApp(options: CreateAppOptions) {
  const { config } = options;

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
        origin: config.app.host,
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
    .route('/', routes)
    .notFound((c) => c.json({ error: 'Not Found' }, 404));

  app.get('/api/docs/json', async (c) => {
    const spec = await generateSpecs(app, {
      documentation: OPENAPI_DOCUMENTATION,
    });

    return c.json(spec);
  });

  // Start scheduler
  services.scheduler.start();

  return { app, services, cleanup, logger };
}

export type AppType = Awaited<ReturnType<typeof createApp>>['app'];
