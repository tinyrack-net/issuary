import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';
import { createServer as createViteServer, type ViteDevServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');
const SHARED_FRONTEND_PORT_ENV = 'E2E_SHARED_FRONTEND_PORT';
/**
 * Every worker shares this one Vite dev server, so any module still cold when
 * the run starts gets transformed while the machine is at its busiest and every
 * worker waiting on it stalls. Warming by directory rather than by filename
 * keeps that from silently rotting: the previous hand-listed set still named
 * components that had been deleted, so the login route — the first page nearly
 * every test loads — was only partly warm.
 *
 * Test files are excluded; they are never requested by the browser.
 */
const E2E_FRONTEND_WARMUP_FILES = [
  'src/main.tsx',
  'src/routeTree.gen.ts',
  'src/components/**/*.tsx',
  'src/features/**/*.tsx',
  'src/routes/**/*.tsx',
  'src/hooks/**/*.ts',
  'src/i18n/**/*.ts',
  'src/libs/**/*.ts',
  'src/queries/**/*.ts',
  '!src/**/*.test.tsx',
  '!src/**/*.test.ts',
  '!src/test-utils/**',
];

/**
 * TanStack Router serves route components from a `?tsr-split=component` URL,
 * which the glob warmup above does not cover, so the two entry routes are
 * requested in that exact form as well.
 */
const E2E_FRONTEND_WARMUP_URLS = [
  '/src/main.tsx',
  '/src/routeTree.gen.ts',
  '/src/routes/login/index.tsx?tsr-split=component',
  '/src/routes/login/password/index.tsx?tsr-split=component',
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
