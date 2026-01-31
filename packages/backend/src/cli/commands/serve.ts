import { Command } from 'commander';
import { createServer } from '../../server.js';
import { startScheduler } from '../scheduler.js';

/**
 * Serve command
 *
 * Starts the TinyAuth server with all plugins, services, and routes.
 * If scheduler is enabled in config, starts the in-process job scheduler.
 */
export const serveCommand = new Command('serve')
  .description('Start the TinyAuth server')
  .action(async () => {
    const app = await createServer();

    // Start scheduler if enabled in config
    if (app.config.scheduler.enabled) {
      await startScheduler(app);
    }

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      app.log.info({ signal }, 'Received shutdown signal');
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
