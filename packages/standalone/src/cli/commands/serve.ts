import { serve } from '@hono/node-server';
import { Command, Flags } from '@oclif/core';
import { createStandaloneApp } from '#standalone/app.js';
import { loadConfig } from '#standalone/lib/load-config.js';

/**
 * Serve command
 *
 * Starts the TinyAuth server with all middleware,
 * services, and routes.
 *
 * For maintenance tasks like cleanup and key rotation,
 * run: `tinyauth cleanup` as a separate process or
 * Kubernetes CronJob.
 */
export default class ServeCommand extends Command {
  static override description = 'Start the TinyAuth server';

  static override flags = {
    'config-path': Flags.string({
      char: 'c',
      description: 'Path to config file',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ServeCommand);

    try {
      const config = loadConfig(flags['config-path']);
      const { app, cleanup, services, logger } = await createStandaloneApp({
        config,
      });

      const server = serve(
        {
          fetch: app.fetch,
          port: services.config.server.listen_port,
          hostname: '0.0.0.0',
        },
        (info) => {
          logger.info(
            { port: info.port },
            `Server listening on port ${info.port}`,
          );
        },
      );

      const shutdown = async (signal: string) => {
        logger.info({ signal }, `Received ${signal}, shutting down...`);
        if (server) {
          server.close();
        }
        await cleanup();
        process.exit(0);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }
}
