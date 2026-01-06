import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppConfigs } from '@/lib/config.js';
import { env } from '@/lib/env.js';
import BootstrapPlugin from '@/plugins/bootstrap.js';
import CookiePlugin from '@/plugins/cookie.js';
import CORSPlugin from '@/plugins/cors.js';
import MikroORMPlugin from '@/plugins/mikro-orm.js';
import NodeMailerPlugin from '@/plugins/nodemailer.js';
import ScalarPlugin from '@/plugins/scalar.js';
import SecureSessionPlugin from '@/plugins/secure-session.js';
import StaticPlugin from '@/plugins/static.js';
import SwaggerPlugin from '@/plugins/swagger.js';
import ZodPlugin from '@/plugins/zod.js';
import fastifyAutoload from '@fastify/autoload';
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename));

export type FastifyWithZodInstance = Awaited<ReturnType<typeof createServer>>;

export async function createServer() {
  const appInstance = Fastify({
    logger: env.NODE_ENV === 'development',
  }).withTypeProvider<ZodTypeProvider>();

  try {
    appInstance.register(ZodPlugin);
    appInstance.register(CORSPlugin);
    appInstance.register(SwaggerPlugin);
    appInstance.register(ScalarPlugin);
    appInstance.register(CookiePlugin);
    appInstance.register(SecureSessionPlugin);
    appInstance.register(MikroORMPlugin);
    appInstance.register(NodeMailerPlugin);
    appInstance.register(StaticPlugin);
    appInstance.register(BootstrapPlugin);

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

    // if (AppConfigs.admin?.enabled) {
    //   const adminInstance = Fastify({
    //     logger: env.NODE_ENV === 'development',
    //   }).withTypeProvider<ZodTypeProvider>();

    //   await adminInstance.listen({
    //     port: AppConfigs.admin.port,
    //   });

    //   console.log('listening on port', AppConfigs.admin.port);
    // }

    return appInstance;
  } catch (err) {
    appInstance.log.error(err);
    process.exit(1);
  }
}
