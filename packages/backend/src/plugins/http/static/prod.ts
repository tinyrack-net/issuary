import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import type { FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { interpolateHtml } from '@/lib/interpolate-html.js';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

/**
 * @description
 * Production/Test mode static file plugin.
 *
 * - Serves static files from the 'public' directory
 * - Supports SSG (directory index.html) and SPA (fallback to root index.html)
 * - API routes (/api, /application, /.well-known) return 404 when not found
 * - When html_variables is configured, {{KEY}} placeholders in HTML files
 *   are replaced with the corresponding values (lazy-cached on first request)
 */
export default fastifyPlugin(
  async (fastify) => {
    const publicPath = path.join(__dirname, '../../../public');
    const variables = fastify.config.app.html_variables;
    const hasVariables = Object.keys(variables).length > 0;

    /**
     * Lazy cache for interpolated HTML content.
     * Key: absolute file path, Value: interpolated HTML string.
     * Only used when html_variables is configured.
     */
    const htmlCache = new Map<string, string>();

    /**
     * Read an HTML file, apply variable interpolation, cache the result,
     * and send it as the response. On subsequent requests the cached
     * version is returned directly.
     */
    async function sendInterpolatedHtml(
      reply: FastifyReply,
      absolutePath: string,
    ): Promise<void> {
      const cached = htmlCache.get(absolutePath);
      if (cached !== undefined) {
        reply.type('text/html; charset=utf-8').send(cached);
        return;
      }
      const raw = await fs.promises.readFile(absolutePath, 'utf-8');
      const result = interpolateHtml(raw, variables);
      htmlCache.set(absolutePath, result);
      reply.type('text/html; charset=utf-8').send(result);
    }

    await fastify.register(fastifyStatic, {
      root: publicPath,
      prefix: '/',
      wildcard: false,
      /**
       * When html_variables is configured, disable automatic file serving
       * so that all requests go through the notFoundHandler where we can
       * intercept HTML files for interpolation.
       */
      serve: !hasVariables,
      setHeaders: (res, filePath) => {
        /**
         * Serve source map files with correct content type
         * to avoid MIME type warnings in the browser console.
         */
        if (filePath.endsWith('.map')) {
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
      if (request.url.startsWith('/.well-known')) {
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
          if (hasVariables && filePath.endsWith('.html')) {
            return sendInterpolatedHtml(reply, filePath);
          }
          return reply.sendFile(urlPath);
        }

        // If it's a directory, try to serve index.html from that directory
        if (stats.isDirectory()) {
          const indexPath = path.join(filePath, 'index.html');
          try {
            await fs.promises.access(indexPath, fs.constants.F_OK);
            if (hasVariables) {
              return sendInterpolatedHtml(reply, indexPath);
            }
            return reply.sendFile(path.join(urlPath, 'index.html'));
          } catch {
            // No index.html in directory, fall through to SPA fallback
          }
        }
      } catch {
        // File doesn't exist, fall through to SPA fallback
      }

      // SPA fallback: serve root index.html for client-side routing
      if (hasVariables) {
        const indexPath = path.join(publicPath, 'index.html');
        return sendInterpolatedHtml(reply, indexPath);
      }
      return reply.sendFile('index.html');
    });
  },
  { name: 'static-prod-plugin' },
);
