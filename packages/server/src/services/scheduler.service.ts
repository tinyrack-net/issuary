import type { SchedulerConfig, SchedulerHandle } from '../lib/config/index.ts';
import type { Logger } from '../lib/logger.ts';
import type { CleanupService } from './cleanup.service.ts';

export class SchedulerService {
  private readonly cleanupService: CleanupService;
  private readonly logger: Logger;
  private readonly schedulerConfig: SchedulerConfig | undefined;

  private handle: SchedulerHandle | null = null;

  public constructor(
    schedulerConfig: SchedulerConfig | undefined,
    cleanupService: CleanupService,
    logger: Logger,
  ) {
    this.schedulerConfig = schedulerConfig;
    this.cleanupService = cleanupService;
    this.logger = logger;
    this.logger.info(
      {
        enabled: this.schedulerConfig !== undefined,
      },
      'Scheduler initialized',
    );
  }

  public async start(): Promise<void> {
    if (!this.schedulerConfig || this.handle) {
      return;
    }

    const handle = await this.schedulerConfig.start({
      runCleanup: async () => {
        try {
          await this.cleanupService.runAll({
            dryRun: false,
            verbose: false,
          });
        } catch (err) {
          this.logger.error({ err }, 'Scheduled cleanup failed');
        }
      },
    });

    this.handle = handle;
    this.logger.info(
      {
        nextRunAt: this.getNextRunAt(),
      },
      'Scheduler started',
    );
  }

  public async stop(): Promise<void> {
    if (!this.handle) {
      return;
    }

    const handle = this.handle;
    this.handle = null;
    await handle.stop();
    this.logger.info('Scheduler stopped');
  }

  public isRunning(): boolean {
    return this.handle !== null;
  }

  public getNextRunAt(): Date | null {
    return this.handle?.getNextRunAt?.() ?? null;
  }
}
