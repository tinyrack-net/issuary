import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyAutoload from '@fastify/autoload';
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { InternalAppConfig } from '@/lib/config/index.js';
import { env } from '@/lib/env.js';
import 'reflect-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename));

declare module 'fastify' {
  interface FastifyInstance {
    config: InternalAppConfig;
  }
}

export type FastifyWithZodInstance = Awaited<ReturnType<typeof createServer>>;

export interface CreateServerOptions {
  /**
   * Pre-loaded application configuration.
   * The caller is responsible for loading and merging config before passing it.
   */
  config: InternalAppConfig;
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
}

export async function createServer(options: CreateServerOptions) {
  const { config, skipListen, cliMode } = options;

  // Create Fastify instance with config-based trustProxy
  const appInstance = Fastify({
    logger: {
      enabled: env.APP_ENV !== 'production',
    },
    trustProxy: config.app.trust_proxy,
  }).withTypeProvider<ZodTypeProvider>();

  appInstance.log.info('Server initialized with provided config');

  try {
    // Register config as a decorator for DI
    appInstance.decorate('config', config);

    // Core plugins (always loaded - database, config seeding, validation, email)
    await appInstance.register(fastifyAutoload, {
      dir: path.join(__dirname, 'plugins/core'),
      ignorePattern: /(.+\.test|.spec)\.(ts|js)$/,
    });

    // HTTP plugins (skip in CLI mode - cors, session, static, swagger, etc.)
    if (!cliMode) {
      await appInstance.register(fastifyAutoload, {
        dir: path.join(__dirname, 'plugins/http'),
        ignorePattern: /(.+\.test|.spec)\.(ts|js)$/,
      });
    }

    // Services (always loaded - some needed for CLI commands like cleanup)
    await appInstance.register(fastifyAutoload, {
      dir: path.join(__dirname, 'services'),
      ignorePattern: /(.+\.test|.spec)\.(ts|js)$/,
    });

    // Routes (skip in CLI mode)
    if (!cliMode) {
      await appInstance.register(fastifyAutoload, {
        dir: path.join(__dirname, 'routes'),
        routeParams: true,
        autoHooks: true,
        options: {},
        ignorePattern: /(.+\.test|.spec)\.(ts|js)$/,
      });
    }

    if (env.APP_ENV !== 'test' && !skipListen) {
      await appInstance.listen({
        host: '0.0.0.0',
        port: config.app.port,
      });
      console.log('listening on port', config.app.port);
    }

    return appInstance;
  } catch (err) {
    appInstance.log.error(err);
    console.error(err);
    process.exit(1);
  }
}
