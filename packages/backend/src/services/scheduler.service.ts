import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import type { CleanupService } from '@backend/services/cleanup.service.js';
import { Cron } from 'croner';

export class SchedulerService {
  public cleanupJob: Cron | null = null;

  public constructor(
    private readonly config: ResolvedAppConfig,
    private readonly cleanupService: CleanupService,
    private readonly options?: { silent?: boolean },
  ) {
    const silent = this.options?.silent ?? false;
    if (!silent) {
      console.info(
        'Scheduler initialized (enabled: %s, cron: %s)',
        this.config.scheduler.enabled,
        this.config.scheduler.cron,
      );
    }
  }

  public start(): void {
    const { enabled, cron } = this.config.scheduler;
    if (!enabled || this.cleanupJob) return;
    const job = new Cron(cron, async () => {
      try {
        await this.cleanupService.runAll({
          dryRun: false,
          verbose: false,
        });
      } catch (error) {
        console.error(
          'Scheduled cleanup failed:',
          error instanceof Error ? error.message : String(error),
        );
      }
    });
    this.cleanupJob = job;
  }

  public stop(): void {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
    }
  }
}
