import 'reflect-metadata';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename));

declare module 'fastify' {
  interface FastifyInstance {
    config: InternalAppConfig;
  }
}

export type FastifyWithZodInstance = Awaited<
  ReturnType<ReturnType<typeof createServer>['start']>
>;

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

export function createServer(options?: CreateServerOptions) {
  const appInstance = Fastify({
    logger: {
      enabled: env.APP_ENV !== 'production',
    },
  }).withTypeProvider<ZodTypeProvider>();

  const start = async () => {
    try {
      // Load config with optional overrides
      const config = await loadConfig({
        ...(options?.configPath && { configPath: options.configPath }),
        ...(options?.baseConfig && { baseConfig: options.baseConfig }),
        ...(options?.configOverrides && { overrides: options.configOverrides }),
      });

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
  };

  const stop = async () => {
    await appInstance.close();
  };

  return {
    start,
    stop,
  };
}
