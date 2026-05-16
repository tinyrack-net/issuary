import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateSpecs } from 'hono-openapi';
import {
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
import { routes } from '../routes/index.ts';
import { e, TinyAuthError } from '../schemas/error.ts';
import {
  type InitializeServicesOptions,
  initializeServices,
} from '../services/container.ts';

/**
 * Application configuration for the backend runtime.
 */
export type CreateAppOptions = TinyAuthRuntimeConfigInput;
export type CreateAppRuntimeOptions = InitializeServicesOptions;

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
    .use('*', mikroOrmMiddleware)
    .route('/', routes)
    .notFound(async (c) => {
      if (frontendHandler) {
        return frontendHandler(c);
      }
      return c.json({ error: 'Not Found' }, 404);
    });

  app.get('/api/docs/json', async (c) => {
    if (!config.openapi.enabled) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const spec = await generateSpecs(app, {
      documentation: openApiDocumentation,
    });

    return c.json(spec);
  });

  // Start scheduler
  await services.scheduler.start();

  return { app, services, cleanup, logger };
}

export type AppType = Awaited<ReturnType<typeof createApp>>['app'];
