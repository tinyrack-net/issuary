import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';
import { createServer as createViteServer, type ViteDevServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');
const SHARED_FRONTEND_PORT_ENV = 'E2E_SHARED_FRONTEND_PORT';
const E2E_FRONTEND_WARMUP_FILES = [
  'src/main.tsx',
  'src/routeTree.gen.ts',
  'src/routes/login/index.tsx',
  'src/routes/login/password/index.tsx',
  'src/components/auth/auth-field.tsx',
  'src/components/auth/auth-method-tile.tsx',
  'src/features/layout/auth-layout.tsx',
  'src/features/layout/auth-brand-panel.tsx',
  'src/hooks/**/*.ts',
  'src/i18n/**/*.ts',
  'src/libs/**/*.ts',
  'src/queries/**/*.ts',
];
const E2E_FRONTEND_WARMUP_URLS = [
  '/src/main.tsx',
  '/src/routeTree.gen.ts',
  '/src/routes/login/index.tsx?tsr-split=component',
  '/src/routes/login/password/index.tsx?tsr-split=component',
  '/src/components/auth/auth-field.tsx',
  '/src/components/auth/auth-method-tile.tsx',
  '/src/features/layout/auth-layout.tsx',
  '/src/features/layout/auth-brand-panel.tsx',
  '/src/queries/config.ts',
  '/src/queries/session.ts',
  '/src/libs/oauth-search.ts',
];

function getListeningPort(address: AddressInfo | string | null): number {
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve shared frontend port from Vite server');
  }

  return address.port;
}

async function warmupFrontendServer(
  frontendServer: ViteDevServer,
): Promise<void> {
  await Promise.all(
    E2E_FRONTEND_WARMUP_URLS.map((url) => frontendServer.warmupRequest(url)),
  );
}

export default async function globalSetup(_config: FullConfig) {
  const frontendServer = await createViteServer({
    root: frontendRoot,
    server: {
      hmr: false,
      port: 0,
      strictPort: false,
      warmup: {
        clientFiles: E2E_FRONTEND_WARMUP_FILES,
      },
    },
  });

  await frontendServer.listen();

  const httpServer = frontendServer.httpServer;
  if (!httpServer) {
    throw new Error('Vite HTTP server is not available after listen()');
  }

  const frontendPort = getListeningPort(httpServer.address());
  await warmupFrontendServer(frontendServer);
  process.env[SHARED_FRONTEND_PORT_ENV] = String(frontendPort);

  return async () => {
    delete process.env[SHARED_FRONTEND_PORT_ENV];
    await frontendServer.close();
  };
}
