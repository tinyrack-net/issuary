import { serve } from '@hono/node-server';
import type { AppType } from '#backend/app.js';
import { createApp } from '#backend/app.js';
import type { AppConfigInput } from '#backend/lib/config/index.js';

export type { AppType };

export interface CreateServerOptions {
  /**
   * Application configuration in external format.
   * This will be resolved to internal format with
   * all defaults applied.
   * Only `app.cookie_secret` is required - all other
   * fields have defaults.
   */
  config: AppConfigInput;
}

export async function createServer(createOptions: CreateServerOptions) {
  const { app, services, cleanup, logger } = await createApp({
    config: createOptions.config,
  });

  // Start HTTP server if not test
  const server = serve(
    {
      fetch: app.fetch,
      port: services.config.app.port,
      hostname: '0.0.0.0',
    },
    (info) => {
      logger.info({ port: info.port }, `Server listening on port ${info.port}`);
    },
  );

  return { app, services, cleanup, server, logger };
}
