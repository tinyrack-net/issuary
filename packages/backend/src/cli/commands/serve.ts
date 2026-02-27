import { serve } from '@hono/node-server';
import { Command } from 'commander';
import { createApp } from '../../app.js';
import {
  type AppConfig,
  ConfigValidationError,
  loadConfig,
} from '../../lib/config/index.js';

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
  .action(async (options: { configPath?: string }) => {
    let config: AppConfig;
    try {
      config = loadConfig({
        configPath: options.configPath,
      });
    } catch (err) {
      if (err instanceof ConfigValidationError) {
        console.error(err.message);
        process.exit(1);
      }
      throw err;
    }

    const { app, cleanup, services, logger } = await createApp({
      config,
    });

    const server = serve(
      {
        fetch: app.fetch,
        port: services.config.app.port,
        hostname: '0.0.0.0',
      },
      (info) => {
        logger.info(
          { port: info.port },
          `Server listening on port ${info.port}`,
        );
      },
    );

    // Handle graceful shutdown
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
  });
