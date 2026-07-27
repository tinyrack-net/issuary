import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';
import { preview as createVitePreviewServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');
const frontendOutput = path.resolve(frontendRoot, '../server/public');
const SHARED_FRONTEND_PORT_ENV = 'E2E_SHARED_FRONTEND_PORT';

function getListeningPort(address: AddressInfo | string | null): number {
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve shared frontend port');
  }

  return address.port;
}

export default async function globalSetup(_config: FullConfig) {
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

  return async () => {
    delete process.env[SHARED_FRONTEND_PORT_ENV];
    await frontendServer.close();
  };
}
