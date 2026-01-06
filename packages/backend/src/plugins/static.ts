import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import fastifyPlugin from 'fastify-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename));

export default fastifyPlugin(async (fastify) => {
  const publicPath = path.join(__dirname, '../../public');

  // Serve static files from public directory
  await fastify.register(fastifyStatic, {
    root: publicPath,
    prefix: '/',
    wildcard: false,
  });

  // SPA fallback: serve index.html for all non-API routes
  fastify.setNotFoundHandler(async (request, reply) => {
    // Don't handle API routes - let them return 404
    if (request.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    // For all other routes, serve index.html (SPA fallback)
    return reply.sendFile('index.html');
  });
}, {
  name: 'static-plugin',
});
