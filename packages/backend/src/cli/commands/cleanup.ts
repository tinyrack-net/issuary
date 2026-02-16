import { Command } from 'commander';
import { loadConfig, resolveConfig } from '../../lib/config/index.js';
import {
  initializeServices,
  type ServiceContainer,
} from '../../services/container.js';

/**
 * Cleanup command
 *
 * Run all cleanup tasks to maintain database health.
 * Designed for use with Kubernetes CronJobs.
 *
 * Usage:
 *   tinyauth cleanup              # Run all tasks
 *   tinyauth cleanup --dry-run    # Show what would
 *                                   be cleaned
 *   tinyauth cleanup --verbose    # Show detailed
 *                                   progress
 */
export const cleanupCommand = new Command('cleanup')
  .description('Run all cleanup and maintenance tasks')
  .option('-c, --config-path <path>', 'Path to config file')
  .option('-n, --dry-run', 'Show what would be cleaned without deleting', false)
  .option('-v, --verbose', 'Show detailed progress for each task', false)
  .action(
    async (options: {
      configPath?: string;
      dryRun: boolean;
      verbose: boolean;
    }) => {
      const { configPath, dryRun, verbose } = options;

      // Print header
      console.info('TinyAuth Cleanup');
      if (dryRun) {
        console.warn('[DRY RUN] No changes will be made');
      }

      // Initialize services directly (skip Hono app
      // creation for faster startup)
      if (verbose) {
        console.debug('Initializing services...');
      }

      let services: ServiceContainer | undefined;
      let cleanup: (() => Promise<void>) | undefined;

      try {
        const config = loadConfig(configPath ? { configPath } : undefined);
        const resolved = await resolveConfig(config);
        const result = await initializeServices(resolved, {
          skipListen: false,
          silent: true,
        });
        services = result.services;
        cleanup = result.cleanup;
      } catch (error) {
        console.error('Failed to initialize:', error);
        process.exit(1);
      }

      try {
        const summary = await services.cleanupService.runAll({
          dryRun,
          verbose,
        });

        // Print results for each task
        const totalTasks = summary.tasks.length;
        for (let i = 0; i < summary.tasks.length; i++) {
          const taskResult = summary.tasks[i];
          if (!taskResult) continue;
          const { description, result, error, durationMs } = taskResult;
          const index = i + 1;
          const prefix = `[${index}/${totalTasks}]`;

          if (error) {
            console.error(`${prefix} ${description}: ${error.message}`);
          } else if (result.skipped) {
            if (verbose) {
              console.debug(
                `${prefix} ${description}: Skipped - ${result.message || 'Disabled'}`,
              );
            }
          } else {
            if (result.deletedCount > 0) {
              const action = dryRun ? 'Would delete' : 'Deleted';
              const suffix = result.message ? ` (${result.message})` : '';
              console.info(
                `${prefix} ${description}: ${action} ${result.deletedCount}${suffix}`,
              );
            } else {
              console.info(
                `${prefix} ${description}: ${result.message || 'Nothing to clean'}`,
              );
            }
            if (verbose) {
              console.debug(`  Duration: ${durationMs}ms`);
            }
          }
        }

        // Print summary
        const verb = dryRun ? 'would be cleaned' : 'cleaned';
        console.info(`Summary: ${summary.totalDeleted} items ${verb}`);

        if (summary.totalSkipped > 0 && verbose) {
          console.debug(`         ${summary.totalSkipped} tasks skipped`);
        }

        if (summary.totalFailed > 0) {
          console.error(`         ${summary.totalFailed} tasks failed`);
        }

        console.info(`Duration: ${summary.totalDurationMs}ms`);

        // Exit with error code if any task failed
        if (summary.totalFailed > 0) {
          await cleanup();
          process.exit(1);
        }
      } catch (error) {
        console.error('Cleanup failed:', error);
        await cleanup();
        process.exit(1);
      }

      // Graceful shutdown
      await cleanup();
      process.exit(0);
    },
  );
