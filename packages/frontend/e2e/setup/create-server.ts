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

export type TestHonoApp = Awaited<ReturnType<typeof createE2EServer>>['app'];

/**
 * Creates and starts the Vite dev server + backend server pair
 * for an e2e test config group.
 *
 * Registers test-only endpoints on the backend for accessing
 * email verification tokens and TOTP secrets during e2e tests.
 *
 * @param config - Backend app configuration
 * @param ports - Port numbers for backend and Vite servers
 * @returns Object with teardown function
 */
export async function createE2EServer(config: AppConfigInput, ports: E2EPorts) {
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
    port: ports.backend,
    hostname: '0.0.0.0',
  });

  // 4. Return server handle
  return {
    app: testApp,
    teardown: async () => {
      backendServer.close();
      await frontendServer.close();
      await cleanup();
    },
  };
}
