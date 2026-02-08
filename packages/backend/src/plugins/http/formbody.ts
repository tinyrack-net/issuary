import fastifyFormbody from '@fastify/formbody';
import fastifyPlugin from 'fastify-plugin';

export default fastifyPlugin(
  (fastify) => {
    fastify.register(fastifyFormbody);

    if (!fastify.serverOptions.silent) {
      console.info('Formbody plugin registered');
    }
  },
  {
    name: 'formbody-plugin',
    dependencies: [],
  },
);
