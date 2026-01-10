import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import fastifyPlugin from 'fastify-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename));

/**
 * @description
 * Serves static files from the 'public' directory.
 * Supports both SSG (Static Site Generation) and SPA (Single Page Application) modes.
 *
 * - API routes (/api, /application, /docs) return 404 when not found
 * - Static files (HTML, JS, CSS, images, etc.) are served if they exist
 * - All other routes fall back to index.html for client-side routing (SPA mode)
 */
export default fastifyPlugin(
  async (fastify) => {
    const publicPath = path.join(__dirname, '../../public');

    await fastify.register(fastifyStatic, {
      root: publicPath,
      prefix: '/',
      wildcard: false,
      setHeaders: (res, path) => {
        /**
         * Serve source map files with correct content type
         * to avoid MIME type warnings in the browser console.
         */
        if (path.endsWith('.map')) {
          res.setHeader('Content-Type', 'application/json');
        }
      },
    });

    fastify.setNotFoundHandler(async (request, reply) => {
      // API routes should return 404 errors
      if (request.url.startsWith('/api')) {
        return reply.code(404).send({ error: 'Not Found' });
      }
      if (request.url.startsWith('/application')) {
        return reply.code(404).send({ error: 'Not Found' });
      }
      if (request.url.startsWith('/docs')) {
        return reply.code(404).send({ error: 'Not Found' });
      }

      // Try to serve the requested file for SSG support
      // Remove query string from URL
      const urlPath = request.url.split('?')[0] ?? '/';
      const filePath = path.join(publicPath, urlPath);

      // Check if the requested path is a file that exists
      try {
        const stats = await fs.promises.stat(filePath);
        if (stats.isFile()) {
          return reply.sendFile(urlPath);
        }

        // If it's a directory, try to serve index.html from that directory
        if (stats.isDirectory()) {
          const indexPath = path.join(filePath, 'index.html');
          try {
            await fs.promises.access(indexPath, fs.constants.F_OK);
            return reply.sendFile(path.join(urlPath, 'index.html'));
          } catch {
            // No index.html in directory, fall through to SPA fallback
          }
        }
      } catch {
        // File doesn't exist, fall through to SPA fallback
      }

      // SPA fallback: serve root index.html for client-side routing
      return reply.sendFile('index.html');
    });
  },
  {
    name: 'static-plugin',
  },
);
