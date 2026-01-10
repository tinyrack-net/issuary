import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyReplyFrom from '@fastify/reply-from';
import fastifyStatic from '@fastify/static';
import fastifyPlugin from 'fastify-plugin';
import { env } from '@/lib/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename));

/**
 * @description
 * In development and test environments, proxy static file requests to Vite dev server.
 * In production, serve static files from the 'public' directory.
 */
export default fastifyPlugin(
  async (fastify) => {
    if (env.APP_ENV === 'development' || env.APP_ENV === 'test') {
      await fastify.register(fastifyReplyFrom);
      fastify.addHook('onRequest', async (request, reply) => {
        if (
          request.url.startsWith('/api') ||
          request.url.startsWith('/application') ||
          request.url.startsWith('/docs')
        ) {
          return;
        }
        await reply.from(`http://localhost:5173${request.url}`);
        return reply.sent;
      });
      return;
    }

    const publicPath = path.join(__dirname, '../../public');

    await fastify.register(fastifyStatic, {
      root: publicPath,
      prefix: '/',
      wildcard: false,
    });

    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api')) {
        return reply.code(404).send({ error: 'Not Found' });
      }
      if (request.url.startsWith('/application')) {
        return reply.code(404).send({ error: 'Not Found' });
      }
      return reply.sendFile('index.html');
    });
  },
  {
    name: 'static-plugin',
  },
);
