import { Command } from 'commander';
import { loadConfig } from '../../lib/config/index.js';
import { createServer } from '../../server.js';

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
    const config = await loadConfig({
      configPath: options.configPath,
    });
    const { cleanup, server } = await createServer({
      config,
    });

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.info(`Received ${signal}, shutting down...`);
      if (server) {
        server.close();
      }
      await cleanup();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
