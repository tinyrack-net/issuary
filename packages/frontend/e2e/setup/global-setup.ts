import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';
import {
  createServer as createViteDevServer,
  preview as createVitePreviewServer,
} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');
const frontendOutput = path.resolve(frontendRoot, '../server/public');
const SHARED_FRONTEND_PORT_ENV = 'E2E_SHARED_FRONTEND_PORT';
const SCREEN_LAB_ROUTE_HOST_ORIGIN_ENV = 'SCREEN_LAB_ROUTE_HOST_ORIGIN';

function getListeningPort(address: AddressInfo | string | null): number {
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve shared frontend port');
  }

  return address.port;
}

export default async function globalSetup(config: FullConfig) {
  /*
   * E2E validation runs after the workspace build. Serving that immutable
   * output keeps parallel browser workers away from Vite's development-time
   * transform and dependency-optimization lifecycle.
   */
  const frontendServer = await createVitePreviewServer({
    build: {
      outDir: frontendOutput,
    },
    configFile: false,
    preview: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
    },
    root: frontendRoot,
  });
  const frontendPort = getListeningPort(frontendServer.httpServer.address());
  process.env[SHARED_FRONTEND_PORT_ENV] = String(frontendPort);

  const screenLabEnabled = config.projects.some(
    (project) => project.name === 'screen-lab:chromium',
  );
  const routeHostServer = screenLabEnabled
    ? await createViteDevServer({
        root: frontendRoot,
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
    delete process.env[SHARED_FRONTEND_PORT_ENV];
    await routeHostServer?.close();
    await frontendServer.close();
  };
}
