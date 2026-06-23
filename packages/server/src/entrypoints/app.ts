import { RequestContext } from '@mikro-orm/core';
import type { Context, Next } from 'hono';
import { Hono } from 'hono';
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
  await RequestContext.create(services.mikro.em, () =>
    services.jwtService.ensureActiveKey(),
  );

  const frontendHandler = config.frontend?.({
    branding: config.branding,
    server: config.server,
  });

  const handleError = (err: Error, c: Context) => {
    if (err instanceof TinyAuthError) {
      if (err.code === 'insufficient_scope') {
        c.header(
          'WWW-Authenticate',
          'Bearer error="insufficient_scope", scope="openid"',
        );
      }

      if (c.req.path.startsWith('/oauth/')) {
        return c.json(toOAuthErrorJson(err), err.status);
      }

      return c.json(err.toJson(), err.status);
    }

    logger.error({ err }, 'Unhandled error');
    const internalErr = new e.InternalServerError.Error();
    return c.json(internalErr.toJson(), internalErr.status);
  };

  const app = new Hono()
    .onError(handleError)
    .use('*', loggerMiddleware(logger))
    .use('*', firstPartyCors(config.server.public_origin))
    .use(
      '*',
      sessionMiddleware(
        config.security.session_secret,
        config.server.public_origin.startsWith('https'),
      ),
    )
    .use('*', trustedProxyGuard(config.server.trust_proxy))
    .use('/api/*', csrfProtection(config.server.public_origin))
    .use('/oauth/device', csrfProtection(config.server.public_origin))
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

function firstPartyCors(publicOrigin: string) {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const origin = c.req.header('origin');
    if (c.req.path.startsWith('/oauth/')) {
      await next();
      return undefined;
    }

    if (origin !== publicOrigin) {
      await next();
      return undefined;
    }

    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', 'Origin');

    if (c.req.method === 'OPTIONS') {
      c.header(
        'Access-Control-Allow-Methods',
        'GET,HEAD,PUT,POST,DELETE,PATCH',
      );
      const requestHeaders = c.req.header('access-control-request-headers');
      if (requestHeaders) {
        c.header('Access-Control-Allow-Headers', requestHeaders);
        c.header('Vary', 'Access-Control-Request-Headers', { append: true });
      }
      return c.body(null, 204);
    }

    await next();
    return undefined;
  };
}

function toOAuthErrorJson(err: TinyAuthError) {
  return {
    ...err.toJson(),
    error: toOAuthErrorCode(err),
    error_description: err.message,
  };
}

function toOAuthErrorCode(err: TinyAuthError): string {
  switch (err.code) {
    case 'INVALID_CLIENT_CREDENTIALS':
    case 'OAUTH_CLIENT_NOT_FOUND':
      return 'invalid_client';
    case 'UNSUPPORTED_GRANT_TYPE':
      return 'unsupported_grant_type';
    case 'INVALID_SCOPE':
      return 'invalid_scope';
    case 'INVALID_AUTHORIZATION_CODE':
    case 'INVALID_DEVICE_CODE':
    case 'REDIRECT_URI_MISMATCH':
    case 'INVALID_PKCE_VERIFIER':
    case 'INVALID_REFRESH_TOKEN':
    case 'CLIENT_ID_MISMATCH':
      return 'invalid_grant';
    case 'INVALID_ACCESS_TOKEN':
    case 'MISSING_AUTHORIZATION_HEADER':
    case 'INVALID_AUTHORIZATION_HEADER_FORMAT':
    case 'MISSING_BEARER_TOKEN':
      return 'invalid_token';
    case 'insufficient_scope':
      return 'insufficient_scope';
    case 'authorization_pending':
      return 'authorization_pending';
    case 'slow_down':
      return 'slow_down';
    default:
      return 'invalid_request';
  }
}
