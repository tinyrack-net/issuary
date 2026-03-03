import { ConfigValidationError } from '@tinyauth/backend/config';
import { createLogger } from '@tinyauth/backend/logger';
import {
  initializeServices,
  type ServiceContainer,
} from '@tinyauth/backend/services';
import { Command } from 'commander';
import {
  loadResolvedConfig,
  toBackendConfig,
} from '#standalone/lib/load-config.js';

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

      let services: ServiceContainer | undefined;
      let cleanup: (() => Promise<void>) | undefined;

      try {
        const resolved = await loadResolvedConfig(
          configPath ? { configPath } : undefined,
        );
        const backendConfig = toBackendConfig(resolved);
        const logger = createLogger({
          logging: {
            ...backendConfig.logging,
            level: verbose ? 'debug' : 'info',
          },
        });

        logger.info('TinyAuth Cleanup');
        if (dryRun) {
          logger.warn('[DRY RUN] No changes will be made');
        }
        if (verbose) {
          logger.debug('Initializing services...');
        }

        const result = await initializeServices(backendConfig, logger);
        services = result.services;
        cleanup = result.cleanup;

        const summary = await services.cleanupService.runAll({
          dryRun,
          verbose,
        });

        // Print results for each task
        const totalTasks = summary.tasks.length;
        for (let i = 0; i < summary.tasks.length; i++) {
          const taskResult = summary.tasks[i];
          if (!taskResult) continue;
          const {
            description,
            result: taskRes,
            error,
            durationMs,
          } = taskResult;
          const index = i + 1;
          const prefix = `[${index}/${totalTasks}]`;

          if (error) {
            logger.error(`${prefix} ${description}: ${error.message}`);
          } else if (taskRes.skipped) {
            if (verbose) {
              logger.debug(
                `${prefix} ${description}: Skipped - ${taskRes.message || 'Disabled'}`,
              );
            }
          } else {
            if (taskRes.deletedCount > 0) {
              const action = dryRun ? 'Would delete' : 'Deleted';
              const suffix = taskRes.message ? ` (${taskRes.message})` : '';
              logger.info(
                `${prefix} ${description}: ${action} ${taskRes.deletedCount}${suffix}`,
              );
            } else {
              logger.info(
                `${prefix} ${description}: ${taskRes.message || 'Nothing to clean'}`,
              );
            }
            if (verbose) {
              logger.debug(`  Duration: ${durationMs}ms`);
            }
          }
        }

        // Print summary
        const verb = dryRun ? 'would be cleaned' : 'cleaned';
        logger.info(`Summary: ${summary.totalDeleted} items ${verb}`);

        if (summary.totalSkipped > 0 && verbose) {
          logger.debug(`         ${summary.totalSkipped} tasks skipped`);
        }

        if (summary.totalFailed > 0) {
          logger.error(`         ${summary.totalFailed} tasks failed`);
        }

        logger.info(`Duration: ${summary.totalDurationMs}ms`);

        // Exit with error code if any task failed
        if (summary.totalFailed > 0) {
          await cleanup();
          process.exit(1);
        }
      } catch (err) {
        if (err instanceof ConfigValidationError) {
          console.error(err.message);
          if (cleanup) {
            await cleanup();
          }
          process.exit(1);
        }
        // Use console.error as fallback since logger
        // may not be initialized
        console.error('Cleanup failed:', err);
        if (cleanup) {
          await cleanup();
        }
        process.exit(1);
      }

      // Graceful shutdown
      await cleanup();
      process.exit(0);
    },
  );
