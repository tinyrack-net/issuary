import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import type { AppConfigInput } from '@tinyauth/backend/app';
import { createApp } from '@tinyauth/backend/app';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');

interface E2EPorts {
  readonly backend: number;
  readonly frontend: number;
}

/**
 * Creates and starts the Vite dev server + backend server pair
 * for an e2e test config group.
 *
 * @param config - Backend app configuration
 * @param ports - Port numbers for backend and Vite servers
 * @returns Teardown function that stops both servers
 */
export async function createE2EServer(
  config: AppConfigInput,
  ports: E2EPorts,
): Promise<() => Promise<void>> {
  // 1. Start Vite dev server
  const frontendServer = await createViteServer({
    root: frontendRoot,
    server: {
      port: ports.frontend,
      strictPort: true,
    },
  });
  await frontendServer.listen();

  // 2. Start backend
  const { app, cleanup } = await createApp({ config });

  const backendServer = serve({
    fetch: app.fetch,
    port: ports.backend,
    hostname: '0.0.0.0',
  });

  // 3. Return teardown function
  return async () => {
    backendServer.close();
    await frontendServer.close();
    await cleanup();
  };
}
