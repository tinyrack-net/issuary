import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyAutoload from '@fastify/autoload';
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  type DeepPartial,
  type InternalAppConfig,
  loadConfig,
} from '@/lib/config/index.js';
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
   * Custom config file path.
   */
  configPath?: string;
  /**
   * Base config object to use instead of loading from file (useful for testing).
   */
  baseConfig?: InternalAppConfig;
  /**
   * Partial config to override loaded values (useful for testing).
   */
  configOverrides?: DeepPartial<InternalAppConfig>;
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

export async function createServer(options?: CreateServerOptions) {
  // Load config first to use in Fastify instance creation
  const config = await loadConfig({
    ...(options?.configPath && { configPath: options.configPath }),
    ...(options?.baseConfig && { baseConfig: options.baseConfig }),
    ...(options?.configOverrides && { overrides: options.configOverrides }),
  });

  // Create Fastify instance with config-based trustProxy
  const appInstance = Fastify({
    logger: {
      enabled: env.APP_ENV !== 'production',
    },
    trustProxy: config.app.trust_proxy,
  }).withTypeProvider<ZodTypeProvider>();

  appInstance.log.info(`App config loaded: ${env.CONFIG_PATH}`);

  try {
    // Register config as a decorator for DI
    appInstance.decorate('config', config);

    // Core plugins (always loaded - database, config seeding, validation, email)
    await appInstance.register(fastifyAutoload, {
      dir: path.join(__dirname, 'plugins/core'),
      ignorePattern: /(.+\.test|.spec)\.(ts|js)$/,
    });

    // HTTP plugins (skip in CLI mode - cors, session, static, swagger, etc.)
    if (!options?.cliMode) {
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
    if (!options?.cliMode) {
      await appInstance.register(fastifyAutoload, {
        dir: path.join(__dirname, 'routes'),
        routeParams: true,
        autoHooks: true,
        options: {},
        ignorePattern: /(.+\.test|.spec)\.(ts|js)$/,
      });
    }

    if (env.APP_ENV !== 'test' && !options?.skipListen) {
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
