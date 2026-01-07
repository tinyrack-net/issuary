import 'reflect-metadata';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyAutoload from '@fastify/autoload';
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AppConfigs } from '@/lib/config.js';
import { env } from '@/lib/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename));

export type FastifyWithZodInstance = Awaited<ReturnType<ReturnType<typeof createServer>['start']>>;

export function createServer() {
  const appInstance = Fastify({
    logger: {
      enabled: env.APP_ENV !== 'production',
      transport: {
        target: 'pino-pretty',
        // options: {
        //   colorize: true,
        // },
      },
    },
  }).withTypeProvider<ZodTypeProvider>();

  const start = async () => {
    try {
      await appInstance.register(fastifyAutoload, {
        dir: path.join(__dirname, 'plugins'),
        ignorePattern: /(.+\.test|.spec)\.(ts|js)$/,
      })

      await appInstance.register(fastifyAutoload, {
        dir: path.join(__dirname, 'routes'),
        routeParams: true,
        autoHooks: true,
        options: {},
        ignorePattern: /(.+\.test|.spec)\.(ts|js)$/
      });

      if (env.APP_ENV !== 'test') {
        await appInstance.listen({
          port: AppConfigs.app.port,
        });
      }

      console.log('listening on port', AppConfigs.app.port);

      return appInstance;
    } catch (err) {
      appInstance.log.error(err);
      process.exit(1);
    }
  }

  const stop = async () => {
    await appInstance.close();
  }

  return {
    start,
    stop,
  }
}
