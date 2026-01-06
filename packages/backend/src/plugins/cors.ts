import fastifyCors from '@fastify/cors';
import fastifyPlugin from 'fastify-plugin';

export interface CorsPluginOptions {
  host: string;
}

export default fastifyPlugin<CorsPluginOptions>(
  (fastify, options) => {
    fastify.register(fastifyCors, {
      origin: [options.host],
      credentials: true,
    });
  },
  {
    name: 'cors-plugin',
    dependencies: [],
  },
);
