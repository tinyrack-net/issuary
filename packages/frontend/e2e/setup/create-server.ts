import type { AddressInfo } from 'node:net';
import { createServer as createNetServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import type { AppConfigInput } from '@tinyauth/backend/app';
import { createApp } from '@tinyauth/backend/app';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '../..');

export type TestHonoApp = Awaited<ReturnType<typeof createE2EServer>>['app'];

/**
 * Finds a free port by briefly binding to port 0.
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

type ConfigFactory = (
  backendPort: number,
  frontendPort: number,
) => AppConfigInput;

/**
 * Creates and starts the Vite dev server + backend server pair
 * for an e2e test config group using dynamically allocated ports.
 *
 * Registers test-only endpoints on the backend for accessing
 * email verification tokens and TOTP secrets during e2e tests.
 *
 * @param configFactory - Factory that produces config given ports
 * @returns Object with backendPort and teardown function
 */
export async function createE2EServer(configFactory: ConfigFactory) {
  const [backendPort, frontendPort] = await Promise.all([
    getFreePort(),
    getFreePort(),
  ]);

  const config = configFactory(backendPort, frontendPort);

  // 1. Start Vite dev server
  const frontendServer = await createViteServer({
    root: frontendRoot,
    server: {
      port: frontendPort,
      strictPort: true,
    },
  });
  await frontendServer.listen();

  // 2. Start backend
  const { app, services, cleanup } = await createApp({ config });

  // 3. Register test-only API endpoints
  const testApp = app
    .get('/test/email-token/:email', async (c) => {
      const email = c.req.param('email');
      const user = await services.mikro.user.findOne({ email });
      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }
      const token = await services.mikro.emailVerification.findOne(
        { user: user.sub, verified: false },
        { orderBy: { created_at: 'desc' } },
      );
      if (!token) {
        return c.json({ error: 'No pending token' }, 404);
      }
      return c.json({ token: token.token });
    })
    .get('/test/totp-secret/:userSub', async (c) => {
      const userSub = c.req.param('userSub');
      const totp = await services.mikro.userTotp.findOne(
        { user: userSub },
        { populate: ['secret'] },
      );
      if (!totp) {
        return c.json({ error: 'TOTP not found' }, 404);
      }
      return c.json({ secret: totp.secret });
    })
    .get('/test/password-reset-token/:email', async (c) => {
      const email = c.req.param('email');
      const user = await services.mikro.user.findOne({ email });
      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }
      const reset = await services.mikro.passwordReset.findOne(
        { user: user.sub, used: false },
        { orderBy: { created_at: 'desc' } },
      );
      if (!reset) {
        return c.json({ error: 'No pending reset token' }, 404);
      }
      return c.json({ token: reset.token });
    });

  const backendServer = serve({
    fetch: testApp.fetch,
    port: backendPort,
    hostname: '0.0.0.0',
  });

  // 4. Return server handle
  return {
    app: testApp,
    backendPort,
    teardown: async () => {
      backendServer.close();
      await frontendServer.close();
      await cleanup();
    },
  };
}
