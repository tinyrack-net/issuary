import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');
const SHARED_FRONTEND_PORT_ENV = 'E2E_SHARED_FRONTEND_PORT';

function getListeningPort(address: AddressInfo | string | null): number {
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve shared frontend port from Vite server');
  }

  return address.port;
}

export default async function globalSetup(_config: FullConfig) {
  const frontendServer = await createViteServer({
    root: frontendRoot,
    server: {
      port: 0,
      strictPort: false,
    },
  });

  await frontendServer.listen();

  const httpServer = frontendServer.httpServer;
  if (!httpServer) {
    throw new Error('Vite HTTP server is not available after listen()');
  }

  const frontendPort = getListeningPort(httpServer.address());
  process.env[SHARED_FRONTEND_PORT_ENV] = String(frontendPort);

  return async () => {
    delete process.env[SHARED_FRONTEND_PORT_ENV];
    await frontendServer.close();
  };
}
