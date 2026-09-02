import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createServer as createViteDevServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');
const SCREEN_LAB_ROUTE_HOST_ORIGIN_ENV = 'SCREEN_LAB_ROUTE_HOST_ORIGIN';

function getListeningPort(address: AddressInfo | string | null): number {
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve shared frontend port');
  }

  return address.port;
}

export default async function globalSetup(config: FullConfig) {
  const screenLabEnabled = config.projects.some(
    (project) => project.name === 'screen-lab:chromium',
  );
  const routeHostServer = screenLabEnabled
    ? await createViteDevServer({
        configFile: false,
        root: frontendRoot,
        plugins: [react(), tailwindcss()],
        resolve: {
          alias: {
            '#frontend': path.resolve(frontendRoot, 'src'),
            '#frontend-e2e': path.resolve(frontendRoot, 'e2e'),
          },
        },
        server: {
          host: '127.0.0.1',
          port: 0,
          strictPort: false,
        },
      })
    : undefined;

  if (routeHostServer) {
    await routeHostServer.listen();
    const routeHostPort = getListeningPort(
      routeHostServer.httpServer?.address() ?? null,
    );
    process.env[SCREEN_LAB_ROUTE_HOST_ORIGIN_ENV] =
      `http://127.0.0.1:${routeHostPort}`;
  }

  return async () => {
    delete process.env[SCREEN_LAB_ROUTE_HOST_ORIGIN_ENV];
    await routeHostServer?.close();
  };
}
