import { Command, Flags } from '@oclif/core';
import {
  initializeServices,
  type ServiceContainer,
} from '@tinyauth/backend/services';
import z from 'zod';
import { loadConfig, resolveConfig } from '#standalone/lib/load-config.js';
import { createLogger } from '#standalone/lib/logger.js';
import { zodFlag } from '#standalone/lib/oclif/zod-flag.js';

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
export default class CleanupCommand extends Command {
  static override description = 'Run all cleanup and maintenance tasks';

  static override flags = {
    'config-path': zodFlag(
      z
        .string()
        .trim()
        .min(1, 'must not be empty')
        .describe('Path to config file'),
      {
        char: 'c',
        label: 'config-path',
      },
    ),
    'dry-run': Flags.boolean({
      char: 'n',
      description: 'Show what would be cleaned without deleting',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed progress for each task',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CleanupCommand);
    const configPath = flags['config-path'];
    const dryRun = flags['dry-run'];
    const { verbose } = flags;

    let services: ServiceContainer | undefined;
    let cleanup: (() => Promise<void>) | undefined;
    let exitCode = 0;

    try {
      const resolved = await resolveConfig(loadConfig(configPath));
      const logger = createLogger({
        logging: {
          ...resolved.logging,
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

      const result = await initializeServices(resolved, logger);
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
        const { description, result: taskRes, error, durationMs } = taskResult;
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
        exitCode = 1;
      }
    } catch (err) {
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
    process.exit(exitCode);
  }
}
