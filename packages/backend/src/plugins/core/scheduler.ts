import { Cron } from 'croner';
import fastifyPlugin from 'fastify-plugin';
import { runCleanup } from '@/cli/cleanup/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    scheduler: {
      cleanupJob: Cron | null;
      /** Start the scheduler (called automatically after services are loaded) */
      start: () => void;
    };
  }
}

/**
 * In-process scheduler plugin for automated cleanup tasks.
 *
 * This plugin starts a cron job that runs all cleanup tasks on a schedule.
 * It's designed for single Docker container deployments where external
 * schedulers (like Kubernetes CronJobs) are not available.
 *
 * For Kubernetes deployments, disable this plugin via config and use
 * `tinyauth cleanup` with external CronJobs instead.
 */
export default fastifyPlugin(
  async (fastify) => {
    const { enabled, cron } = fastify.config.scheduler;

    const scheduler = {
      cleanupJob: null as Cron | null,
      start: () => {
        // Only start if enabled and not already started
        if (!enabled || scheduler.cleanupJob) {
          return;
        }

        fastify.log.info({ cron }, 'Starting in-process cleanup scheduler');

        const job = new Cron(cron, async () => {
          const startTime = Date.now();
          fastify.log.info('Starting scheduled cleanup tasks');

          try {
            const summary = await runCleanup(fastify, {
              dryRun: false,
              verbose: false,
            });

            const duration = Date.now() - startTime;

            if (summary.totalFailed > 0) {
              fastify.log.warn(
                {
                  totalDeleted: summary.totalDeleted,
                  totalSkipped: summary.totalSkipped,
                  totalFailed: summary.totalFailed,
                  durationMs: duration,
                  failedTasks: summary.tasks
                    .filter((t) => t.error)
                    .map((t) => ({
                      name: t.name,
                      error: t.error?.message,
                    })),
                },
                'Scheduled cleanup completed with errors',
              );
            } else {
              fastify.log.info(
                {
                  totalDeleted: summary.totalDeleted,
                  totalSkipped: summary.totalSkipped,
                  durationMs: duration,
                },
                'Scheduled cleanup completed successfully',
              );
            }
          } catch (error) {
            fastify.log.error(
              { error: error instanceof Error ? error.message : String(error) },
              'Scheduled cleanup failed unexpectedly',
            );
          }
        });

        scheduler.cleanupJob = job;

        const nextRun = job.nextRun();
        fastify.log.info(
          { nextRun: nextRun?.toISOString() },
          'Cleanup scheduler started',
        );
      },
    };

    fastify.decorate('scheduler', scheduler);

    if (!enabled) {
      fastify.log.info('In-process scheduler is disabled');
      return;
    }

    // Stop scheduler on server close
    fastify.addHook('onClose', async () => {
      if (fastify.scheduler.cleanupJob) {
        fastify.scheduler.cleanupJob.stop();
        fastify.log.info('Cleanup scheduler stopped');
      }
    });
  },
  {
    name: 'scheduler-plugin',
  },
);
