import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import type { Logger } from '@backend/lib/logger.js';
import type { CleanupService } from '@backend/services/cleanup.service.js';
import { Cron } from 'croner';

export class SchedulerService {
  public cleanupJob: Cron | null = null;

  public constructor(
    private readonly config: ResolvedAppConfig,
    private readonly cleanupService: CleanupService,
    private readonly logger: Logger,
  ) {
    this.logger.info(
      {
        enabled: this.config.scheduler.enabled,
        cron: this.config.scheduler.cron,
      },
      'Scheduler initialized',
    );
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
      } catch (err) {
        this.logger.error({ err }, 'Scheduled cleanup failed');
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
