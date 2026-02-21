import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from '@tinyauth/backend/app';
import { createServer as createViteServer } from 'vite';
import { E2E_BACKEND_CONFIG, E2E_PORTS } from '../fixtures/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');

/**
 * Playwright globalSetup.
 *
 * 1. Starts a Vite dev server for the frontend on port 19080.
 * 2. Creates the backend app via createApp() and serves it
 *    on port 18080 with @hono/node-server.
 *    The backend is configured in proxy mode, forwarding
 *    non-API requests to the Vite dev server.
 * 3. Returns a teardown function that stops both servers.
 */
export default async function globalSetup() {
  // 1. Start Vite dev server
  const viteServer = await createViteServer({
    root: frontendRoot,
    server: {
      port: E2E_PORTS.vite,
      strictPort: true,
    },
  });
  await viteServer.listen();

  // 2. Start backend
  const { app, cleanup } = await createApp({
    config: E2E_BACKEND_CONFIG,
  });

  const backendServer = serve({
    fetch: app.fetch,
    port: E2E_PORTS.backend,
    hostname: '0.0.0.0',
  });

  // 3. Return teardown function
  return async () => {
    backendServer.close();
    await viteServer.close();
    await cleanup();
  };
}
