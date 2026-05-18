import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateSpecs } from 'hono-openapi';
import {
  type TinyAuthRuntimeConfig,
  type TinyAuthRuntimeConfigInput,
  TinyAuthRuntimeConfigSchema,
} from '../lib/config/index.ts';
import { createLogger } from '../lib/logger.ts';
import { createOpenApiDocumentation } from '../lib/openapi.ts';
import { csrfProtection } from '../middleware/csrf.ts';
import { loggerMiddleware } from '../middleware/logger.ts';
import { mikroOrmMiddleware } from '../middleware/mikro-orm.ts';
import { servicesMiddleware } from '../middleware/services.ts';
import { sessionMiddleware } from '../middleware/session.ts';
import { trustedProxyGuard } from '../middleware/trusted-proxy-guard.ts';
import { adminApiRoutes } from '../routes/admin/index.ts';
import { routes } from '../routes/index.ts';
import { e, TinyAuthError } from '../schemas/error.ts';
import {
  type InitializeServicesOptions,
  initializeServices,
  type ServiceContainer,
} from '../services/container.ts';

/**
 * Application configuration for the backend runtime.
 */
export type CreateAppOptions = TinyAuthRuntimeConfigInput;
export type CreateAppRuntimeOptions = InitializeServicesOptions;

export type CreateAdminAppOptions = {
  config: TinyAuthRuntimeConfig;
  services: ServiceContainer;
};

export function createAdminApp({ config, services }: CreateAdminAppOptions) {
  const logger = createLogger({ logging: config.logging });
  const adminOrigin =
    config.admin.public_origin ??
    (config.admin.mode === 'separate-port' && config.admin.listen_port
      ? `http://${config.admin.bind_host}:${config.admin.listen_port}`
      : config.server.public_origin);
  const adminFrontendHandler = config.admin.frontend?.({
    branding: config.branding,
    server: config.server,
  });

  const app = new Hono()
    .onError((err, c) => {
      if (err instanceof TinyAuthError) {
        if (err.code === 'insufficient_scope') {
          c.header(
            'WWW-Authenticate',
            'Bearer error="insufficient_scope", scope="openid"',
          );
        }

        return c.json(err.toJson(), err.status);
      }

      logger.error({ err }, 'Unhandled error');
      const internalErr = new e.InternalServerError.Error();
      return c.json(internalErr.toJson(), internalErr.status);
    })
    .use('*', loggerMiddleware(logger))
    .use(
      '*',
      cors({
        origin: adminOrigin,
        credentials: true,
      }),
    )
    .use(
      '*',
      sessionMiddleware(
        config.security.session_secret,
        adminOrigin.startsWith('https'),
      ),
    )
    .use('*', trustedProxyGuard(config.server.trust_proxy))
    .use(`${config.admin.mount_path}/api/*`, csrfProtection(adminOrigin))
    .use('*', servicesMiddleware(services))
    .use('*', mikroOrmMiddleware)
    .route(`${config.admin.mount_path}/api`, adminApiRoutes)
    .all(`${config.admin.mount_path}/api`, (c) =>
      c.json({ error: 'Not Found' }, 404),
    )
    .all(`${config.admin.mount_path}/api/*`, (c) =>
      c.json({ error: 'Not Found' }, 404),
    );

  if (adminFrontendHandler) {
    if (config.admin.frontend_mode === 'proxy') {
      app.get(config.admin.mount_path, (c) =>
        c.redirect(`${config.admin.mount_path}/`),
      );
    } else {
      app.all(config.admin.mount_path, adminFrontendHandler);
    }
    app.all(`${config.admin.mount_path}/*`, adminFrontendHandler);
  }

  return app.notFound((c) => c.json({ error: 'Not Found' }, 404));
}

export async function createApp(
  options: CreateAppOptions,
  runtimeOptions: CreateAppRuntimeOptions = {},
) {
  const config = TinyAuthRuntimeConfigSchema.parse(options);
  const openApiDocumentation = createOpenApiDocumentation(config.openapi);

  // Create root logger (use config.logging.level: 'silent' to suppress)
  const logger = createLogger({ logging: config.logging });

  // Initialize all services (DB, mail, scheduler, etc.)
  const { services, cleanup } = await initializeServices(
    config,
    logger,
    runtimeOptions,
  );

  const frontendHandler = config.frontend?.({
    branding: config.branding,
    server: config.server,
  });
  const adminFrontendHandler =
    config.admin.enabled && config.admin.mode === 'same-port'
      ? config.admin.frontend?.({
          branding: config.branding,
          server: config.server,
        })
      : undefined;

  const app = new Hono()
    .onError((err, c) => {
      if (err instanceof TinyAuthError) {
        if (err.code === 'insufficient_scope') {
          c.header(
            'WWW-Authenticate',
            'Bearer error="insufficient_scope", scope="openid"',
          );
        }

        return c.json(err.toJson(), err.status);
      }

      logger.error({ err }, 'Unhandled error');
      const internalErr = new e.InternalServerError.Error();
      return c.json(internalErr.toJson(), internalErr.status);
    })
    .use('*', loggerMiddleware(logger))
    .use(
      '*',
      cors({
        origin: config.server.public_origin,
        credentials: true,
      }),
    )
    .use(
      '*',
      sessionMiddleware(
        config.security.session_secret,
        config.server.public_origin.startsWith('https'),
      ),
    )
    .use('*', trustedProxyGuard(config.server.trust_proxy))
    .use('/api/*', csrfProtection(config.server.public_origin))
    .use('*', servicesMiddleware(services))
    .use('*', mikroOrmMiddleware);

  if (config.admin.enabled && config.admin.mode === 'same-port') {
    app.use(
      `${config.admin.mount_path}/api/*`,
      csrfProtection(config.server.public_origin),
    );
    app.route(`${config.admin.mount_path}/api`, adminApiRoutes);
    app.all(`${config.admin.mount_path}/api`, (c) =>
      c.json({ error: 'Not Found' }, 404),
    );
    app.all(`${config.admin.mount_path}/api/*`, (c) =>
      c.json({ error: 'Not Found' }, 404),
    );

    if (adminFrontendHandler) {
      if (config.admin.frontend_mode === 'proxy') {
        app.get(config.admin.mount_path, (c) =>
          c.redirect(`${config.admin.mount_path}/`),
        );
      } else {
        app.all(config.admin.mount_path, adminFrontendHandler);
      }
      app.all(`${config.admin.mount_path}/*`, adminFrontendHandler);
    }
  }

  const routedApp = app.route('/', routes).notFound(async (c) => {
    if (frontendHandler) {
      return frontendHandler(c);
    }
    return c.json({ error: 'Not Found' }, 404);
  });

  routedApp.get('/api/docs/json', async (c) => {
    if (!config.openapi.enabled) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const spec = await generateSpecs(routedApp, {
      documentation: openApiDocumentation,
    });

    return c.json(spec);
  });

  // Start scheduler
  await services.scheduler.start();

  return { app: routedApp, services, cleanup, logger };
}

export type AppType = Awaited<ReturnType<typeof createApp>>['app'];
