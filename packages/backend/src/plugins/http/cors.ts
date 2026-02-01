import fastifyCors from '@fastify/cors';
import fastifyPlugin from 'fastify-plugin';
import { env } from '@/lib/env.js';

export default fastifyPlugin(
  (fastify) => {
    // In development, allow all origins for easier testing
    // In production, restrict to known origins
    const allowedOrigins =
      env.APP_ENV === 'development'
        ? true // Allow all origins in development
        : [
            fastify.config.app.host,
            // Add additional production origins here if needed
          ];

    fastify.register(fastifyCors, {
      origin: allowedOrigins,
      credentials: true,
    });
  },
  {
    name: 'cors-plugin',
    dependencies: [],
  },
);
