import fastifyCookie from '@fastify/cookie';
import fastifyPlugin from 'fastify-plugin';

export default fastifyPlugin(
  (fastify) => {
    fastify.register(fastifyCookie, {
      hook: 'onRequest',
    });
  },
  {
    name: 'cookie-plugin',
    dependencies: [],
  },
);
