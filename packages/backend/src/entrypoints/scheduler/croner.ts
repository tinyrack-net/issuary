import { Cron } from 'croner';
import type {
  SchedulerConfig,
  SchedulerHandle,
} from '../../lib/config/index.ts';

const DEFAULT_CRON = '0 2 * * *';

export interface CronerSchedulerOptions {
  cron?: string | undefined;
}

export function croner(options: CronerSchedulerOptions = {}): SchedulerConfig {
  const cron = options.cron ?? DEFAULT_CRON;

  return {
    start({ runCleanup }) {
      const job = new Cron(cron, async () => {
        await runCleanup();
      });

      const handle: SchedulerHandle = {
        stop() {
          job.stop();
        },
        getNextRunAt() {
          return job.nextRun() ?? null;
        },
      };

      return handle;
    },
  };
}
