import { Cron } from 'croner';
import type {
  SchedulerConfig,
  SchedulerHandle,
} from '../../lib/config/index.ts';

const DEFAULT_CRON = '0 2 * * *';

export interface CronerSchedulerOptions {
  cleanupCron?: string | undefined;
}

export function croner(options: CronerSchedulerOptions = {}): SchedulerConfig {
  const cleanupCron = options.cleanupCron ?? DEFAULT_CRON;

  return {
    cleanupCron,
    start({ scheduledJobs, logger }) {
      const cronJobs = scheduledJobs.map(
        (job) =>
          new Cron(job.schedule.expression, async () => {
            try {
              await job.handler({ logger });
            } catch (err) {
              logger?.error({ err, jobId: job.id }, 'Scheduled job failed');
            }
          }),
      );

      const handle: SchedulerHandle = {
        stop() {
          for (const cronJob of cronJobs) {
            cronJob.stop();
          }
        },
        getNextRunAt() {
          const nextRuns = cronJobs
            .map((cronJob) => cronJob.nextRun() ?? null)
            .filter((nextRun) => nextRun !== null);

          return nextRuns.reduce<Date | null>((earliest, nextRun) => {
            if (!earliest || nextRun.getTime() < earliest.getTime()) {
              return nextRun;
            }

            return earliest;
          }, null);
        },
        async enqueue() {
          throw new Error(
            'Background jobs require a durable scheduler backend',
          );
        },
      };

      return handle;
    },
  };
}
