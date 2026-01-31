import { Command } from 'commander';
import { createServer } from '../../server.js';

/**
 * Serve command
 *
 * Starts the TinyAuth server with all plugins, services, and routes.
 *
 * For maintenance tasks like cleanup and key rotation, run:
 * `tinyauth cleanup` as a separate process or Kubernetes CronJob.
 */
export const serveCommand = new Command('serve')
  .description('Start the TinyAuth server')
  .action(async () => {
    const app = await createServer();

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      app.log.info({ signal }, 'Received shutdown signal');
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
