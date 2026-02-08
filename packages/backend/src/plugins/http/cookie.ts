import fastifyCookie from '@fastify/cookie';
import fastifyPlugin from 'fastify-plugin';

export default fastifyPlugin(
  (fastify) => {
    fastify.register(fastifyCookie, {
      hook: 'onRequest',
    });

    if (!fastify.serverOptions.silent) {
      console.info('Cookie plugin registered');
    }
  },
  {
    name: 'cookie-plugin',
    dependencies: [],
  },
);
