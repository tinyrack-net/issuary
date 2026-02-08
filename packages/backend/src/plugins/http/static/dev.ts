import http from 'node:http';
import fastifyPlugin from 'fastify-plugin';

/**
 * Default Vite dev server URL.
 * Can be overridden via VITE_DEV_SERVER_URL environment variable.
 */
const VITE_DEV_SERVER_URL = 'http://localhost:8081';

/**
 * Parse URL string to hostname and port.
 */
function parseUpstream(url: string): { hostname: string; port: number } {
  const parsed = new URL(url);
  return {
    hostname: parsed.hostname,
    port:
      Number.parseInt(parsed.port, 10) ||
      (parsed.protocol === 'https:' ? 443 : 80),
  };
}

/**
 * @description
 * Development mode static file plugin.
 * Proxies all non-API requests to Vite dev server for HMR support,
 * including WebSocket connections.
 */
export default fastifyPlugin(
  async (fastify) => {
    fastify.log.info(
      `Development mode: Proxying static files to Vite dev server at ${VITE_DEV_SERVER_URL}`,
    );

    const upstream = parseUpstream(VITE_DEV_SERVER_URL);

    // Handle WebSocket upgrade requests
    fastify.server.on('upgrade', (req, socket, head) => {
      const url = req.url || '/';
      // Only proxy WebSocket requests that are not API routes
      if (url.startsWith('/api') || url.startsWith('/application')) {
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
          `HTTP/1.1 101 Switching Protocols\r\n${Object.entries(
            proxyRes.headers,
          )
            .map(([key, value]) => `${key}: ${value}`)
            .join('\r\n')}\r\n\r\n`,
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
        reply.code(404).send({ error: 'Not Found' });
        return;
      }
      if (request.url.startsWith('/application')) {
        reply.code(404).send({ error: 'Not Found' });
        return;
      }
      if (request.url.startsWith('/.well-known')) {
        reply.code(404).send({ error: 'Not Found' });
        return;
      }

      // Hijack the response to handle it manually (no return value needed)
      reply.hijack();

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
          reply.raw.writeHead(502, {
            'Content-Type': 'application/json',
          });
          reply.raw.end(JSON.stringify({ error: 'Proxy error' }));
        }
      });

      request.raw.pipe(proxyReq);
    });
  },
  { name: 'static-dev-plugin' },
);
