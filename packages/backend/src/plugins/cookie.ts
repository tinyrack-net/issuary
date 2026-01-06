import fastifyCookie from '@fastify/cookie';
import fastifyPlugin from 'fastify-plugin';
import { AppConfigs } from '@/lib/config.js';

export default fastifyPlugin(
  (fastify) => {
    fastify.register(fastifyCookie, {
      hook: 'onRequest',
      secret: AppConfigs.app.cookie_secret,
    });
  },
  {
    name: 'cookie-plugin',
    dependencies: [],
  },
);
