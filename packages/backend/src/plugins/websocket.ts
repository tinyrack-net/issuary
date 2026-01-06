import ws from '@fastify/websocket';
import fastifyPlugin from 'fastify-plugin';

export default fastifyPlugin(
  (fastify) => {
    fastify.register(ws);
  },
  {
    name: 'websocket-plugin',
    dependencies: [],
  },
);
