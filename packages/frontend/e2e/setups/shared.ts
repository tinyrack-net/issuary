import path from 'node:path';
import { serve } from '@hono/node-server';
import type { AppConfigInput } from '@tinyauth/backend/app';
import { createApp } from '@tinyauth/backend/app';
import { createServer } from 'vite';

/**
 * Test user credentials used across e2e tests.
 */
export const E2E_TEST_USER = {
  sub: 'e2e-test-user',
  email: 'e2e@example.com',
  password: 'password123',
  role: 'admin',
} as const;

/**
 * Test OAuth client used across e2e tests.
 */
export const E2E_TEST_CLIENT = {
  id: 'e2e-test-client',
  name: 'E2E Test App',
  client_id: 'e2e-client-id',
  client_secret: 'e2e-client-secret',
  redirect_uris: ['http://localhost:18080/callback'],
  response_types: ['code'],
  grant_types: ['authorization_code'],
  scope: 'openid profile email',
} as const;

export interface CreateE2EServerOptions {
  /**
   * Application configuration.
   * Spread MINIMAL_E2E_CONFIG and add test-specific overrides.
   */
  backendConfigs: AppConfigInput;
  /**
   * Port for the backend HTTP server.
   * Convention: 18080 for default, 18081 for totp-required, etc.
   */
  backendPort: number;
  /**
   * Port for the Vite dev server.
   * Convention: backendPort + 1000 (e.g., 19080, 19081).
   */
  frontendPort: number;
}

/**
 * Start a backend server and Vite dev server for e2e tests.
 *
 * The backend is configured with `frontend.mode: 'proxy'` so
 * it forwards non-API routes to the Vite dev server, serving
 * the full application (frontend + backend) on a single port.
 *
 * Returns a teardown function that stops both servers.
 *
 * @example
 * ```ts
 * // e2e/setups/default.setup.ts
 * export default async function setup() {
 *   return createE2EServer({
 *     config: {
   *     ...configs,
 *       users: [E2E_TEST_USER],
 *     },
 *     backendPort: 18080,
 *     frontendPort: 19080,
 *   });
 * }
 * ```
 */
export async function createE2EServer(options: CreateE2EServerOptions) {
  // Start the backend (Hono app)
  const { app, cleanup } = await createApp({
    config: {
      ...options.backendConfigs,
      app: {
        ...options.backendConfigs.app,
        port: options.backendPort,
        host: `http://localhost:${options.backendPort}`,
        frontend: {
          enabled: true,
          mode: 'proxy',
          path: `http://localhost:${options.frontendPort}`,
        },
      },
    },
  });

  const backendServer = serve({
    fetch: app.fetch,
    port: options.backendPort,
    hostname: '0.0.0.0',
  });

  // Start the Vite dev server for the frontend
  const frontendServer = await createServer({
    configFile: path.resolve(__dirname, '../../vite.config.ts'),
    server: {
      port: options.frontendPort,
      strictPort: true,
      // Disable HMR websocket to avoid noise in tests
      hmr: false,
    },
    // Suppress Vite logs during tests
    logLevel: 'silent',
  });

  await frontendServer.listen();

  // Return teardown function
  return async () => {
    await frontendServer.close();
    backendServer.close();
    await cleanup();
  };
}
