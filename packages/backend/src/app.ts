import type { AppType } from '@backend/lib/app.js';
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
import {
  initializeServices,
  type ServerOptions,
  type ServiceContainer,
} from '@backend/services/container.js';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type { AppType };

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
   * CLI mode - only load middleware required for CLI
   * commands. Skips HTTP-related middleware (cors,
   * session, static, swagger, etc.) and routes for
   * faster startup and reduced memory usage.
   */
  cliMode?: boolean | undefined;
  /**
   * Suppress logger output.
   * When true, console output is suppressed.
   * Useful for CLI commands where server logs are
   * noise. Defaults to false.
   */
  silent?: boolean | undefined;
}

export interface CreateAppResult {
  app: AppType;
  services: ServiceContainer;
  cleanup: () => Promise<void>;
}

export async function createApp(
  options: CreateAppOptions,
): Promise<CreateAppResult> {
  const cliMode = options.cliMode ?? false;
  const silent = options.silent ?? false;

  // Resolve external config to internal config
  // with all defaults applied
  const config = await resolveConfig(options.config);

  // Resolve server options with defaults
  const serverOptions: ServerOptions = {
    skipListen: false,
    cliMode,
    silent,
  };

  // Initialize all services (DB, mail, scheduler, etc.)
  const { services, cleanup } = await initializeServices(config, serverOptions);

  // Create OpenAPIHono instance with shared validation hook
  const app = createRouter();

  // Register HTTP middleware (skip in CLI mode)
  if (!cliMode) {
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
  if (!cliMode) {
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

  // Mount all routes (skip in CLI mode)
  if (!cliMode) {
    app.route('/', routes);
  }

  // Register static file handler (skip in CLI mode)
  if (!cliMode) {
    registerStaticHandler(app, config, silent);
  }

  // Start scheduler
  services.scheduler.start();

  return { app, services, cleanup };
}
