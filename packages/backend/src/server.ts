import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyAutoload from '@fastify/autoload';
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AppConfigs } from '@/lib/config.js';
import { env } from '@/lib/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename));

export type FastifyWithZodInstance = Awaited<ReturnType<typeof createServer>>;

export async function createServer() {
  const appInstance = Fastify({
    logger: env.NODE_ENV === 'development',
  }).withTypeProvider<ZodTypeProvider>();

  try {
    await appInstance.register(fastifyAutoload, {
      dir: path.join(__dirname, 'plugins'),
      options: {},
    });

    // Register Routes
    await appInstance.register(fastifyAutoload, {
      dir: path.join(__dirname, 'routes'),
      routeParams: true,
      autoHooks: true,
      options: {},
    });

    await appInstance.listen({
      port: AppConfigs.app.port,
    });
    console.log('listening on port', AppConfigs.app.port);

    if (AppConfigs.admin?.enabled) {
      const adminInstance = Fastify({
        logger: env.NODE_ENV === 'development',
      }).withTypeProvider<ZodTypeProvider>();

      adminInstance.listen({
        port: AppConfigs.admin.port,
      });

      console.log('listening on port', AppConfigs.admin.port);
    }

    return appInstance;
  } catch (err) {
    appInstance.log.error(err);
    process.exit(1);
  }
}
