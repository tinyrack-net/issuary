import { serve } from '@hono/node-server';
import { Command } from 'commander';
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
export const serveCommand = new Command('serve')
  .description('Start the TinyAuth server')
  .option('-c, --config-path <path>', 'Path to config file')
  .action(async (options: { configPath?: string | undefined }) => {
    try {
      const config = loadConfig(options.configPath);
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
  });
