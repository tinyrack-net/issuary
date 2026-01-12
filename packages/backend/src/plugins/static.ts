import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import fastifyPlugin from 'fastify-plugin';
import { env } from '@/lib/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename));

/**
 * Default Vite dev server URL.
 * Can be overridden via VITE_DEV_SERVER_URL environment variable.
 */
const VITE_DEV_SERVER_URL = 'http://localhost:5173';

/**
 * Parse URL string to hostname and port.
 */
function parseUpstream(url: string): { hostname: string; port: number } {
  const parsed = new URL(url);
  return {
    hostname: parsed.hostname,
    port: Number.parseInt(parsed.port, 10) || (parsed.protocol === 'https:' ? 443 : 80),
  };
}

/**
 * @description
 * Serves static files from the 'public' directory.
 * Supports both SSG (Static Site Generation) and SPA (Single Page Application) modes.
 *
 * In development mode (APP_ENV=development):
 * - Proxies all non-API requests to Vite dev server for HMR support
 * - Proxies WebSocket connections for Vite HMR
 *
 * In production/test mode:
 * - API routes (/api, /application, /docs) return 404 when not found
 * - Static files (HTML, JS, CSS, images, etc.) are served if they exist
 * - All other routes fall back to index.html for client-side routing (SPA mode)
 */
export default fastifyPlugin(
  async (fastify) => {
    /**
     * Development mode: Proxy to Vite dev server for HMR support
     */
    if (env.APP_ENV === 'development') {
      fastify.log.info(
        `Development mode: Proxying static files to Vite dev server at ${VITE_DEV_SERVER_URL}`,
      );

      const upstream = parseUpstream(VITE_DEV_SERVER_URL);

      // Handle WebSocket upgrade requests
      fastify.server.on('upgrade', (req, socket, head) => {
        const url = req.url || '/';
        // Only proxy WebSocket requests that are not API routes
        if (
          url.startsWith('/api') ||
          url.startsWith('/application') ||
          url.startsWith('/docs')
        ) {
          socket.destroy();
          return;
        }

        // Create WebSocket proxy connection
        const proxyReq = http.request({
          hostname: upstream.hostname,
          port: upstream.port,
          path: url,
          method: 'GET',
          headers: {
            ...req.headers,
            host: `${upstream.hostname}:${upstream.port}`,
          },
        });

        proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
          socket.write(
            `HTTP/1.1 101 Switching Protocols\r\n` +
              Object.entries(proxyRes.headers)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\r\n') +
              '\r\n\r\n',
          );

          if (proxyHead.length > 0) {
            socket.write(proxyHead);
          }
          if (head.length > 0) {
            proxySocket.write(head);
          }

          proxySocket.pipe(socket);
          socket.pipe(proxySocket);

          proxySocket.on('error', () => socket.destroy());
          socket.on('error', () => proxySocket.destroy());
        });

        proxyReq.on('error', (err) => {
          fastify.log.error(err, 'WebSocket proxy error');
          socket.destroy();
        });

        proxyReq.end();
      });

      // Use setNotFoundHandler to proxy unmatched HTTP routes to Vite
      fastify.setNotFoundHandler((request, reply) => {
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

        // Hijack the response to handle it manually (no return value needed)
        reply.hijack();
        return;

        // Proxy HTTP request to Vite dev server
        const proxyReq = http.request(
          {
            hostname: upstream.hostname,
            port: upstream.port,
            path: request.url,
            method: request.method,
            headers: {
              ...request.headers,
              host: `${upstream.hostname}:${upstream.port}`,
            },
          },
          (proxyRes) => {
            reply.raw.writeHead(
              proxyRes.statusCode || 200,
              proxyRes.statusMessage,
              proxyRes.headers as http.OutgoingHttpHeaders,
            );
            proxyRes.pipe(reply.raw);
          },
        );

        proxyReq.on('error', (err) => {
          fastify.log.error(err, 'Proxy error');
          if (!reply.raw.headersSent) {
            reply.raw.writeHead(502, { 'Content-Type': 'application/json' });
            reply.raw.end(JSON.stringify({ error: 'Proxy error' }));
          }
        });

        request.raw.pipe(proxyReq);
      });

      return;
    }

    /**
     * Production/Test mode: Serve static files from 'public' directory
     */
    const publicPath = path.join(__dirname, '../../public');

    await fastify.register(fastifyStatic, {
      root: publicPath,
      prefix: '/',
      wildcard: false,
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
