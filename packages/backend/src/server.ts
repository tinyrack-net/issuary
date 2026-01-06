import 'reflect-metadata';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyAutoload from '@fastify/autoload';
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename));

export type FastifyWithZodInstance = Awaited<ReturnType<typeof createServer>>;

export async function createServer() {
  const appInstance = Fastify({
    logger: env.APP_ENV !== 'production',
  }).withTypeProvider<ZodTypeProvider>();

  try {
    appInstance.register(ZodPlugin);
    appInstance.register(CORSPlugin, {
      host: AppConfigs.app.host,
    });
    appInstance.register(SwaggerPlugin);
    appInstance.register(ScalarPlugin);
    appInstance.register(CookiePlugin);
    appInstance.register(SecureSessionPlugin, {
      cookieSecret: AppConfigs.app.cookie_secret,
    });
    appInstance.register(MikroORMPlugin, {
      mode: env.APP_ENV,
    });
    if (AppConfigs.smtp?.enabled) {
      appInstance.register(NodeMailerPlugin, {
        smtpHost: AppConfigs.smtp.host,
        smtpPort: AppConfigs.smtp.port,
        smtpUser: AppConfigs.smtp.user,
        smtpPassword: AppConfigs.smtp.password,
        smtpSecure: AppConfigs.smtp.secure,
      });
    }
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

    return appInstance;
  } catch (err) {
    appInstance.log.error(err);
    process.exit(1);
  }
}
