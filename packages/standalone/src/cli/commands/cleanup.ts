import { buildCommand } from '@stricli/core';
import {
  initializeServices,
  type ServiceContainer,
} from '@tinyrack/issuary-server/services';
import z from 'zod';
import { parseWithZod } from '../../lib/cli/parse-with-zod.ts';
import { loadConfig, resolveConfig } from '../../lib/load-config.ts';
import { createLogger } from '../../lib/logger.ts';

/**
 * Cleanup command
 *
 * Run all cleanup tasks to maintain database health.
 * Designed for use with Kubernetes CronJobs.
 *
 * Usage:
 *   issuary cleanup              # Run all tasks
 *   issuary cleanup --dry-run    # Show what would
 *                                   be cleaned
 *   issuary cleanup --verbose    # Show detailed
 *                                   progress
 */
type CleanupFlags = {
  configPath: string;
  dryRun: boolean;
  verbose: boolean;
};

const configPathSchema = z.string().trim().min(1, 'must not be empty');

export async function runCleanupCommand(flags: CleanupFlags): Promise<void> {
  const { configPath, dryRun, verbose } = flags;

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

    logger.info('Issuary Cleanup');
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

    const verb = dryRun ? 'would be cleaned' : 'cleaned';
    logger.info(`Summary: ${summary.totalDeleted} items ${verb}`);

    if (summary.totalSkipped > 0 && verbose) {
      logger.debug(`         ${summary.totalSkipped} tasks skipped`);
    }

    if (summary.totalFailed > 0) {
      logger.error(`         ${summary.totalFailed} tasks failed`);
      exitCode = 1;
    }

    logger.info(`Duration: ${summary.totalDurationMs}ms`);
  } catch (err) {
    console.error('Cleanup failed:', err);
    exitCode = 1;
  } finally {
    await cleanup?.();
  }

  if (exitCode > 0) {
    process.exitCode = exitCode;
  }
}

export const cleanupCommand = buildCommand<CleanupFlags>({
  parameters: {
    flags: {
      configPath: {
        kind: 'parsed',
        brief: 'Path to config file',
        parse: async (input) =>
          await parseWithZod(input, {
            label: 'config-path',
            schema: configPathSchema,
          }),
      },
      dryRun: {
        kind: 'boolean',
        brief: 'Show what would be cleaned without deleting',
        default: false,
      },
      verbose: {
        kind: 'boolean',
        brief: 'Show detailed progress for each task',
        default: false,
      },
    },
    aliases: {
      c: 'configPath',
      n: 'dryRun',
      v: 'verbose',
    },
  },
  docs: {
    brief: 'Run all cleanup and maintenance tasks',
    fullDescription: 'Run all cleanup and maintenance tasks',
  },
  func: runCleanupCommand,
});

export default cleanupCommand;
