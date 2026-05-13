import type {
  BackgroundJobConfig,
  JobPayload,
  ScheduledJobConfig,
  SchedulerConfig,
  SchedulerHandle,
} from '../lib/config/index.ts';
import type { Logger } from '../lib/logger.ts';
import type { CleanupService } from './cleanup.service.ts';

const DEFAULT_CLEANUP_CRON = '0 2 * * *';

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
      scheduledJobs: this.createScheduledJobs(),
      backgroundJobs: this.createBackgroundJobs(),
      logger: this.logger,
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

  public async enqueue<TPayload extends JobPayload>(
    jobId: string,
    payload: TPayload,
    options: { runAt?: Date | undefined } = {},
  ): Promise<string> {
    if (!this.handle) {
      throw new Error('Scheduler is not running');
    }
    if (!this.handle.enqueue) {
      throw new Error('Scheduler backend does not support background jobs');
    }

    return this.handle.enqueue({
      jobId,
      payload,
      runAt: options.runAt,
    });
  }

  private createScheduledJobs(): readonly ScheduledJobConfig[] {
    return [
      {
        id: 'cleanup.run-all',
        name: 'Run cleanup tasks',
        schedule: {
          type: 'cron',
          expression: this.schedulerConfig?.cleanupCron ?? DEFAULT_CLEANUP_CRON,
        },
        handler: async () => {
          try {
            await this.cleanupService.runAll({
              dryRun: false,
              verbose: false,
            });
          } catch (err) {
            this.logger.error({ err }, 'Scheduled cleanup failed');
            throw err;
          }
        },
      },
    ];
  }

  private createBackgroundJobs(): readonly BackgroundJobConfig[] {
    return [];
  }
}
