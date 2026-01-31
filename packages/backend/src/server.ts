import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type DeepPartial,
  type InternalAppConfig,
  loadConfig,
} from '@/lib/config/index.js';
import { env } from '@/lib/env.js';
import fastifyAutoload from '@fastify/autoload';
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
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

    await appInstance.register(fastifyAutoload, {
      dir: path.join(__dirname, 'plugins'),
      ignorePattern: /(.+\.test|.spec)\.(ts|js)$/,
    });

    await appInstance.register(fastifyAutoload, {
      dir: path.join(__dirname, 'services'),
      ignorePattern: /(.+\.test|.spec)\.(ts|js)$/,
    });

    await appInstance.register(fastifyAutoload, {
      dir: path.join(__dirname, 'routes'),
      routeParams: true,
      autoHooks: true,
      options: {},
      ignorePattern: /(.+\.test|.spec)\.(ts|js)$/,
    });

    if (env.APP_ENV !== 'test') {
      await appInstance.listen({
        host: '0.0.0.0',
        port: config.app.port,
      });
    }

    console.log('listening on port', config.app.port);

    return appInstance;
  } catch (err) {
    appInstance.log.error(err);
    console.error(err);
    process.exit(1);
  }
}
