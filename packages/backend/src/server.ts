import { createApp } from '@backend/app.js';
import type { AppType } from '@backend/lib/app.js';
import type { AppConfigInput } from '@backend/lib/config/index.js';
import { env } from '@backend/lib/env.js';
import { serve } from '@hono/node-server';

export type { AppType };
export type { ServerOptions } from '@backend/services/container.js';

export interface CreateServerOptions {
  /**
   * Application configuration in external format.
   * This will be resolved to internal format with
   * all defaults applied.
   * Only `app.cookie_secret` is required - all other
   * fields have defaults.
   */
  config: AppConfigInput;
  /**
   * Skip listening on port (useful for CLI job
   * execution). When true, the server is initialized
   * but does not bind to a port.
   */
  skipListen?: boolean;
  /**
   * Suppress logger output.
   * When true, console output is suppressed.
   * Useful for CLI commands where server logs are
   * noise. Defaults to false.
   */
  silent?: boolean;
}

export async function createServer(createOptions: CreateServerOptions) {
  const { app, services, cleanup } = await createApp({
    config: createOptions.config,
    silent: createOptions.silent,
  });

  // Start HTTP server if not test and not skipListen
  let server: ReturnType<typeof serve> | undefined;
  if (env.APP_ENV !== 'test' && !createOptions.skipListen) {
    server = serve(
      {
        fetch: app.fetch,
        port: services.config.app.port,
        hostname: '0.0.0.0',
      },
      (info) => {
        if (!createOptions.silent) {
          console.info(`Server listening on port ${info.port}`);
        }
      },
    );
  }

  return { app, services, cleanup, server };
}
