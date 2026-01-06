import fastifyCors from '@fastify/cors';
import fastifyPlugin from 'fastify-plugin';
import { AppConfigs } from '@/lib/config.js';

export default fastifyPlugin(
  (fastify) => {
    fastify.register(fastifyCors, {
      origin: [AppConfigs.app.host],
      credentials: true,
    });
  },
  {
    name: 'cors-plugin',
    dependencies: [],
  },
);
