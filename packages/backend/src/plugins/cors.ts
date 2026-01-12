import fastifyCors from '@fastify/cors';
import fastifyPlugin from 'fastify-plugin';

export default fastifyPlugin(
  (fastify) => {
    fastify.register(fastifyCors, {
      origin: [fastify.config.app.host],
      credentials: true,
    });
  },
  {
    name: 'cors-plugin',
    dependencies: [],
  },
);
