import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  type AppConfigInput,
  type ResolvedAppConfig,
  resolveConfig,
} from '@/lib/config/index.js';
import { env } from '@/lib/env.js';
import { registerCorePlugins } from '@/plugins/core/index.js';
import { registerHttpPlugins } from '@/plugins/http/index.js';
import { registerRoutes } from '@/routes/index.js';
import { registerServices } from '@/services/index.js';
import 'reflect-metadata';

export interface ServerOptions {
  skipListen: boolean;
  cliMode: boolean;
  silent: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ResolvedAppConfig;
    serverOptions: ServerOptions;
  }
}

export type FastifyWithZodInstance = Awaited<ReturnType<typeof createServer>>;

export interface CreateServerOptions {
  /**
   * Application configuration in external format.
   * This will be resolved to internal format with all defaults applied.
   * Only `app.cookie_secret` is required - all other fields have defaults.
   */
  config: AppConfigInput;
  /**
   * Skip listening on port (useful for CLI job execution).
   * When true, the server is initialized but does not bind to a port.
   */
  skipListen?: boolean;
  /**
   * CLI mode - only load core plugins required for CLI commands.
   * Skips HTTP-related plugins (cors, session, static, swagger, etc.) and routes
   * for faster startup and reduced memory usage.
   */
  cliMode?: boolean;
  /**
   * Suppress Fastify logger output.
   * When true, the Fastify instance logger is disabled.
   * Useful for CLI commands where server logs are noise.
   * Defaults to false.
   */
  silent?: boolean;
}

export async function createServer(createOptions: CreateServerOptions) {
  const { config: externalConfig } = createOptions;

  // Resolve external config to internal config with all defaults applied
  const config = await resolveConfig(externalConfig);

  // Resolve server options with defaults
  const serverOptions: ServerOptions = {
    skipListen: createOptions.skipListen ?? false,
    cliMode: createOptions.cliMode ?? false,
    silent: createOptions.silent ?? false,
  };

  // Create Fastify instance with config-based trustProxy
  const appInstance = Fastify({
    logger: {
      enabled: !serverOptions.silent && env.APP_ENV !== 'production',
    },
    trustProxy: config.app.trust_proxy,
  }).withTypeProvider<ZodTypeProvider>();

  appInstance.log.info('Server initialized with provided config');

  // Register config and server options as decorators for DI
  appInstance.decorate('config', config);
  appInstance.decorate('serverOptions', serverOptions);

  // Core plugins (always loaded - database, config seeding, validation, email)
  await registerCorePlugins(appInstance);

  // HTTP plugins (skip in CLI mode - cors, session, static, swagger, etc.)
  if (!serverOptions.cliMode) {
    await registerHttpPlugins(appInstance);
  }

  // Services (always loaded - some needed for CLI commands like cleanup)
  await registerServices(appInstance);

  // Start scheduler after services are loaded (if enabled)
  appInstance.scheduler.start();

  // Routes (skip in CLI mode)
  if (!serverOptions.cliMode) {
    await registerRoutes(appInstance);
  }

  if (env.APP_ENV !== 'test' && !serverOptions.skipListen) {
    await appInstance.listen({
      host: '0.0.0.0',
      port: config.app.port,
    });
    appInstance.log.info(`listening on port ${config.app.port}`);
  }

  return appInstance;
}
