// Must be first — extends Zod before any schema is created
import { serve } from '@hono/node-server';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppType } from '@/lib/app.js';
import { type AppConfigInput, resolveConfig } from '@/lib/config/index.js';
import { createRouter } from '@/lib/create-router.js';
import { env } from '@/lib/env.js';
import { authMiddleware } from '@/middleware/auth.js';
import { mikroOrmMiddleware } from '@/middleware/mikro-orm.js';
import { servicesMiddleware } from '@/middleware/services.js';
import { sessionMiddleware } from '@/middleware/session.js';
import { registerStaticHandler } from '@/middleware/static/index.js';
import { trustedProxyGuard } from '@/middleware/trusted-proxy-guard.js';
import routes from '@/routes/index.js';
import { ApiError, e } from '@/schemas/error.js';
import {
  initializeServices,
  type ServerOptions,
} from '@/services/container.js';
import 'reflect-metadata';

export type { AppType };
export type { ApiV1Type } from '@/routes/api/v1/index.js';
export type { AppRouteType } from '@/routes/index.js';
export type { ServerOptions } from '@/services/container.js';

export interface CreateServerOptions {
  /**
   * Application configuration in external format.
   * This will be resolved to internal format with
   * all defaults applied.
   * Only `app.cookie_secret` is required - all other
   * fields have defaults.
   */
  config: AppConfigInput;
  /**
   * Skip listening on port (useful for CLI job
   * execution). When true, the server is initialized
   * but does not bind to a port.
   */
  skipListen?: boolean;
  /**
   * CLI mode - only load middleware required for CLI
   * commands. Skips HTTP-related middleware (cors,
   * session, static, swagger, etc.) and routes for
   * faster startup and reduced memory usage.
   */
  cliMode?: boolean;
  /**
   * Suppress logger output.
   * When true, console output is suppressed.
   * Useful for CLI commands where server logs are
   * noise. Defaults to false.
   */
  silent?: boolean;
}

export async function createServer(createOptions: CreateServerOptions) {
  const { config: externalConfig } = createOptions;

  // Resolve external config to internal config
  // with all defaults applied
  const config = await resolveConfig(externalConfig);

  // Resolve server options with defaults
  const serverOptions: ServerOptions = {
    skipListen: createOptions.skipListen ?? false,
    cliMode: createOptions.cliMode ?? false,
    silent: createOptions.silent ?? false,
  };

  // Initialize all services (DB, mail, scheduler, etc.)
  const { services, cleanup } = await initializeServices(config, serverOptions);

  // Create OpenAPIHono instance with shared validation hook
  const app = createRouter();

  // Register HTTP middleware (skip in CLI mode)
  if (!serverOptions.cliMode) {
    // CORS
    const allowedOrigins =
      env.APP_ENV === 'development' ? '*' : config.app.host;
    app.use(
      '*',
      cors({
        origin: allowedOrigins,
        credentials: true,
      }),
    );

    // Session
    app.use(
      '*',
      sessionMiddleware(
        config.app.cookie_secret,
        config.app.host.startsWith('https'),
      ),
    );

    // Trusted proxy guard
    app.use('*', trustedProxyGuard(config.app.trust_proxy));
  }

  // Service injection middleware (always loaded)
  app.use('*', servicesMiddleware(services));

  // MikroORM RequestContext middleware (always loaded)
  app.use('*', mikroOrmMiddleware);

  // Auth middleware (skip in CLI mode)
  if (!serverOptions.cliMode) {
    app.use('*', authMiddleware);
  }

  // Error handler
  app.onError((err, c) => {
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
  });

  // OpenAPI spec endpoint (OpenAPI 3.1.0)
  app.doc31('/api/docs/json', {
    openapi: '3.1.0',
    info: {
      title: 'TinyAuth API',
      version: '1.0.0',
      description: 'OpenID Connect Provider API',
    },
  });

  // Scalar API reference UI
  app.get(
    '/api/docs',
    apiReference({
      pageTitle: 'TinyAuth API Reference',
      spec: {
        url: '/api/docs/json',
      },
    }),
  );

  // Mount all routes (skip in CLI mode)
  if (!serverOptions.cliMode) {
    app.route('/', routes);
  }

  // Register static file handler (skip in CLI mode)
  if (!serverOptions.cliMode) {
    registerStaticHandler(app, config, serverOptions.silent);
  }

  // Start scheduler
  services.scheduler.start();

  // Start HTTP server if not test and not skipListen
  let server: ReturnType<typeof serve> | undefined;
  if (env.APP_ENV !== 'test' && !serverOptions.skipListen) {
    server = serve(
      {
        fetch: app.fetch,
        port: config.app.port,
        hostname: '0.0.0.0',
      },
      (info) => {
        if (!serverOptions.silent) {
          console.info(`Server listening on port ${info.port}`);
        }
      },
    );
  }

  return { app, services, cleanup, server };
}
