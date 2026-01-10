import fastifyFormbody from '@fastify/formbody';
import fastifyPlugin from 'fastify-plugin';

export default fastifyPlugin(
  (fastify) => {
    fastify.register(fastifyFormbody);
  },
  {
    name: 'formbody-plugin',
    dependencies: [],
  },
);
