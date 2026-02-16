import {
  type AppConfigInput,
  resolveConfig,
} from '@backend/lib/config/index.js';
import { createRouter } from '@backend/lib/create-router.js';
import { env } from '@backend/lib/env.js';
import { authMiddleware } from '@backend/middleware/auth.js';
import { mikroOrmMiddleware } from '@backend/middleware/mikro-orm.js';
import { servicesMiddleware } from '@backend/middleware/services.js';
import { sessionMiddleware } from '@backend/middleware/session.js';
import { registerStaticHandler } from '@backend/middleware/static/index.js';
import { trustedProxyGuard } from '@backend/middleware/trusted-proxy-guard.js';
import { routes } from '@backend/routes/index.js';
import { ApiError, e } from '@backend/schemas/error.js';
import { initializeServices } from '@backend/services/container.js';
import { $ } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export interface CreateAppOptions {
  /**
   * Application configuration in external format.
   * This will be resolved to internal format with
   * all defaults applied.
   * Only `app.cookie_secret` is required - all other
   * fields have defaults.
   */
  config: AppConfigInput;
  /**
   * Suppress logger output.
   * When true, console output is suppressed.
   * Useful for CLI commands where server logs are
   * noise. Defaults to false.
   */
  silent?: boolean | undefined;
}

export async function createApp(options: CreateAppOptions) {
  const silent = options.silent ?? false;

  // Resolve external config to internal config
  // with all defaults applied
  const config = await resolveConfig(options.config);

  // Initialize all services (DB, mail, scheduler, etc.)
  const { services, cleanup } = await initializeServices(config, {
    skipListen: false,
    silent: silent,
  });

  const honoApp = createRouter()
    .onError((err, c) => {
      if (err instanceof ApiError) {
        return c.json(err.toJson(), err.status as ContentfulStatusCode);
      }

      // Zod validation errors from @hono/zod-openapi
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        err.name === 'ZodError'
      ) {
        const zodErr = new e.ValidationError.Error(err.message);
        return c.json(zodErr.toJson(), zodErr.status as ContentfulStatusCode);
      }

      console.error('Unhandled error:', err);
      const internalErr = new e.InternalServerError.Error();
      return c.json(
        internalErr.toJson(),
        internalErr.status as ContentfulStatusCode,
      );
    })
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
    .use('*', authMiddleware);

  const app = $(honoApp)
    .route('/', routes)
    .doc31('/api/docs/json', {
      openapi: '3.1.0',
      info: {
        title: 'TinyAuth API',
        version: '1.0.0',
        description: 'OpenID Connect Provider API',
      },
    });

  // Register static file handler (skip in CLI mode)
  registerStaticHandler(app, config, silent);

  // Start scheduler
  services.scheduler.start();

  return { app, services, cleanup };
}

export type AppType = Awaited<ReturnType<typeof createApp>>['app'];
