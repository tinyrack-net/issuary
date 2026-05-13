import type {
  BackgroundJobConfig,
  EnqueueBackgroundJobOptions,
  JobPayload,
  ScheduledJobConfig,
  SchedulerHandle,
} from '../../lib/config/index.ts';
import type { Logger } from '../../lib/logger.ts';
import { getNextCronRunAt } from './cron.ts';

const MAX_ERROR_LENGTH = 2000;
const MAX_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface PersistedSchedulerJobDefinition {
  id: string;
  name: string;
  cron: string;
}

export interface AcquiredSchedulerJob {
  id: string;
  cron: string;
  runCount: number;
  failureCount: number;
}

export interface AcquiredBackgroundJob {
  id: string;
  jobId: string;
  payload: JobPayload;
  attemptCount: number;
  maxAttempts: number;
}

export interface SchedulerCompletionInput {
  jobId: string;
  cron: string;
  instanceId: string;
  nextRunAt: Date;
  now: Date;
  runCount: number;
}

export interface SchedulerFailureCompletionInput
  extends SchedulerCompletionInput {
  failureCount: number;
  error: string;
}

export interface BackgroundJobEnqueueInput {
  jobId: string;
  payload: JobPayload;
  availableAt: Date;
  maxAttempts: number;
  now: Date;
}

export interface BackgroundJobCompletionInput {
  id: string;
  instanceId: string;
  now: Date;
}

export interface BackgroundJobFailureCompletionInput
  extends BackgroundJobCompletionInput {
  error: string;
  retryAt: Date | null;
  attemptCount: number;
}

export interface DistributedSchedulerStore {
  reconcileJobs: (
    jobs: readonly PersistedSchedulerJobDefinition[],
    now: Date,
  ) => Promise<void>;
  acquireDueJob: (
    now: Date,
    lockedUntil: Date,
    instanceId: string,
  ) => Promise<AcquiredSchedulerJob | null>;
  renewLease: (
    jobId: string,
    instanceId: string,
    lockedUntil: Date,
    now: Date,
  ) => Promise<boolean>;
  completeJobSuccess: (input: SchedulerCompletionInput) => Promise<boolean>;
  completeJobFailure: (
    input: SchedulerFailureCompletionInput,
  ) => Promise<boolean>;
  findNextRunAt: () => Promise<Date | null>;
}

export interface DistributedBackgroundJobStore {
  enqueue: (input: BackgroundJobEnqueueInput) => Promise<string>;
  acquireDueJob: (
    now: Date,
    lockedUntil: Date,
    instanceId: string,
  ) => Promise<AcquiredBackgroundJob | null>;
  renewLease: (
    id: string,
    instanceId: string,
    lockedUntil: Date,
    now: Date,
  ) => Promise<boolean>;
  completeJobSuccess: (input: BackgroundJobCompletionInput) => Promise<boolean>;
  completeJobFailure: (
    input: BackgroundJobFailureCompletionInput,
  ) => Promise<boolean>;
  cleanupCompletedJobs?: (before: Date) => Promise<number>;
}

interface DistributedSchedulerRunnerOptions {
  name: string;
  pollIntervalMs: number;
  lockTtlMs: number;
  instanceId: string;
  jobs: readonly ScheduledJobConfig[];
  logger?: Logger | undefined;
  store: DistributedSchedulerStore;
}

interface DistributedBackgroundJobRunnerOptions {
  name: string;
  pollIntervalMs: number;
  lockTtlMs: number;
  retryDelayMs: number;
  maxAttempts: number;
  retentionMs: number;
  instanceId: string;
  jobs: readonly BackgroundJobConfig[];
  logger?: Logger | undefined;
  store: DistributedBackgroundJobStore;
}

function errorToMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, MAX_ERROR_LENGTH);
}

export class DistributedSchedulerRunner {
  private readonly name: string;
  private readonly pollIntervalMs: number;
  private readonly lockTtlMs: number;
  private readonly instanceId: string;
  private readonly jobs: ReadonlyMap<string, ScheduledJobConfig>;
  private readonly logger: Logger | undefined;
  private readonly store: DistributedSchedulerStore;

  private interval: ReturnType<typeof setInterval> | null = null;
  private runningTick: Promise<void> | null = null;
  private nextRunAt: Date | null = null;
  private stopped = false;

  constructor(options: DistributedSchedulerRunnerOptions) {
    this.name = options.name;
    this.pollIntervalMs = options.pollIntervalMs;
    this.lockTtlMs = options.lockTtlMs;
    this.instanceId = options.instanceId;
    this.jobs = new Map(options.jobs.map((job) => [job.id, job]));
    this.logger = options.logger;
    this.store = options.store;
  }

  async start(): Promise<SchedulerHandle> {
    await this.reconcileJobs();
    this.queueTick();
    this.interval = setInterval(() => this.queueTick(), this.pollIntervalMs);

    return {
      stop: async () => {
        this.stopped = true;
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
        if (this.runningTick) {
          await this.runningTick;
        }
      },
      getNextRunAt: () => this.nextRunAt,
    };
  }

  private queueTick(): void {
    if (this.runningTick || this.stopped) {
      return;
    }

    this.runningTick = this.runTick()
      .catch((err) => {
        this.logger?.error({ err }, `${this.name} scheduler tick failed`);
      })
      .finally(() => {
        this.runningTick = null;
      });
  }

  private async reconcileJobs(): Promise<void> {
    const now = new Date();
    const definitions = [...this.jobs.values()].map((job) => ({
      id: job.id,
      name: job.name,
      cron: job.schedule.expression,
    }));

    await this.store.reconcileJobs(definitions, now);
    this.nextRunAt = await this.store.findNextRunAt();
  }

  private async runTick(): Promise<void> {
    while (!this.stopped) {
      const now = new Date();
      const lockedUntil = new Date(now.getTime() + this.lockTtlMs);
      const acquired = await this.store.acquireDueJob(
        now,
        lockedUntil,
        this.instanceId,
      );
      if (!acquired) {
        this.nextRunAt = await this.store.findNextRunAt();
        return;
      }

      const job = this.jobs.get(acquired.id);
      if (!job) {
        await this.completeJob(
          acquired,
          new Error(`Missing scheduler handler: ${acquired.id}`),
        );
        continue;
      }

      const abortController = new AbortController();
      const stopLeaseRenewal = this.startLeaseRenewal(acquired.id, () => {
        abortController.abort();
      });
      try {
        await job.handler({
          logger: this.logger,
          signal: abortController.signal,
        });
        await this.completeJob(acquired);
      } catch (err) {
        await this.completeJob(acquired, err);
      } finally {
        stopLeaseRenewal();
      }
    }
  }

  private startLeaseRenewal(
    jobId: string,
    onLeaseLost: () => void,
  ): () => void {
    const renewIntervalMs = Math.max(1, Math.floor(this.lockTtlMs / 2));
    let renewInFlight = false;
    const interval = setInterval(() => {
      if (renewInFlight) {
        return;
      }
      renewInFlight = true;
      const now = new Date();
      const lockedUntil = new Date(now.getTime() + this.lockTtlMs);
      void this.store
        .renewLease(jobId, this.instanceId, lockedUntil, now)
        .then((renewed) => {
          if (!renewed) {
            this.logger?.warn(
              { jobId, instanceId: this.instanceId },
              `${this.name} scheduler lease renewal skipped because lease was lost`,
            );
            onLeaseLost();
          }
        })
        .catch((err) => {
          this.logger?.error(
            { err, jobId },
            `${this.name} scheduler lease renewal failed`,
          );
        })
        .finally(() => {
          renewInFlight = false;
        });
    }, renewIntervalMs);

    return () => clearInterval(interval);
  }

  private async completeJob(
    job: AcquiredSchedulerJob,
    err?: unknown,
  ): Promise<void> {
    const now = new Date();
    const nextRunAt = getNextCronRunAt(job.cron, now);
    const runCount = job.runCount + 1;

    const completed =
      err === undefined
        ? await this.store.completeJobSuccess({
            jobId: job.id,
            cron: job.cron,
            instanceId: this.instanceId,
            nextRunAt,
            now,
            runCount,
          })
        : await this.store.completeJobFailure({
            jobId: job.id,
            cron: job.cron,
            instanceId: this.instanceId,
            nextRunAt,
            now,
            runCount,
            failureCount: job.failureCount + 1,
            error: errorToMessage(err),
          });

    if (!completed) {
      this.logger?.warn(
        { jobId: job.id, instanceId: this.instanceId },
        `${this.name} scheduler completion skipped because lease was lost`,
      );
    }

    this.nextRunAt = await this.store.findNextRunAt();
  }
}

export class DistributedBackgroundJobRunner {
  private readonly name: string;
  private readonly pollIntervalMs: number;
  private readonly lockTtlMs: number;
  private readonly retryDelayMs: number;
  private readonly maxAttempts: number;
  private readonly retentionMs: number;
  private readonly cleanupIntervalMs: number;
  private readonly instanceId: string;
  private readonly jobs: ReadonlyMap<string, BackgroundJobConfig>;
  private readonly logger: Logger | undefined;
  private readonly store: DistributedBackgroundJobStore;

  private interval: ReturnType<typeof setInterval> | null = null;
  private runningTick: Promise<void> | null = null;
  private nextCleanupAt = 0;
  private stopped = false;

  constructor(options: DistributedBackgroundJobRunnerOptions) {
    this.name = options.name;
    this.pollIntervalMs = options.pollIntervalMs;
    this.lockTtlMs = options.lockTtlMs;
    this.retryDelayMs = options.retryDelayMs;
    this.maxAttempts = options.maxAttempts;
    this.retentionMs = options.retentionMs;
    this.cleanupIntervalMs = Math.min(
      this.retentionMs,
      MAX_CLEANUP_INTERVAL_MS,
    );
    this.instanceId = options.instanceId;
    this.jobs = new Map(options.jobs.map((job) => [job.id, job]));
    this.logger = options.logger;
    this.store = options.store;
  }

  start(): SchedulerHandle {
    this.queueTick();
    this.interval = setInterval(() => this.queueTick(), this.pollIntervalMs);

    return {
      stop: async () => {
        this.stopped = true;
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
        if (this.runningTick) {
          await this.runningTick;
        }
      },
      enqueue: async (options) => this.enqueue(options),
    };
  }

  async enqueue<TPayload extends JobPayload>(
    options: EnqueueBackgroundJobOptions<TPayload>,
  ): Promise<string> {
    if (!this.jobs.has(options.jobId)) {
      throw new Error(`Unknown background job: ${options.jobId}`);
    }

    const now = new Date();
    return this.store.enqueue({
      jobId: options.jobId,
      payload: options.payload,
      availableAt: options.runAt ?? now,
      maxAttempts: this.maxAttempts,
      now,
    });
  }

  private queueTick(): void {
    if (this.runningTick || this.stopped) {
      return;
    }

    this.runningTick = this.runTick()
      .catch((err) => {
        this.logger?.error({ err }, `${this.name} background job tick failed`);
      })
      .finally(() => {
        this.runningTick = null;
      });
  }

  private async runTick(): Promise<void> {
    await this.cleanupCompletedJobs();

    while (!this.stopped) {
      const now = new Date();
      const lockedUntil = new Date(now.getTime() + this.lockTtlMs);
      const acquired = await this.store.acquireDueJob(
        now,
        lockedUntil,
        this.instanceId,
      );
      if (!acquired) {
        return;
      }

      const job = this.jobs.get(acquired.jobId);
      if (!job) {
        await this.completeJob(
          acquired,
          new Error(`Missing background job handler: ${acquired.jobId}`),
        );
        continue;
      }

      const abortController = new AbortController();
      const stopLeaseRenewal = this.startLeaseRenewal(acquired.id, () => {
        abortController.abort();
      });
      try {
        await job.handler(acquired.payload, {
          logger: this.logger,
          signal: abortController.signal,
        });
        await this.completeJob(acquired);
      } catch (err) {
        await this.completeJob(acquired, err);
      } finally {
        stopLeaseRenewal();
      }
    }
  }

  private async cleanupCompletedJobs(): Promise<void> {
    if (!this.store.cleanupCompletedJobs) {
      return;
    }

    const now = new Date();
    if (now.getTime() < this.nextCleanupAt) {
      return;
    }

    const before = new Date(now.getTime() - this.retentionMs);
    await this.store.cleanupCompletedJobs(before);
    this.nextCleanupAt = now.getTime() + this.cleanupIntervalMs;
  }

  private startLeaseRenewal(id: string, onLeaseLost: () => void): () => void {
    const renewIntervalMs = Math.max(1, Math.floor(this.lockTtlMs / 2));
    let renewInFlight = false;
    const interval = setInterval(() => {
      if (renewInFlight) {
        return;
      }
      renewInFlight = true;
      const now = new Date();
      const lockedUntil = new Date(now.getTime() + this.lockTtlMs);
      void this.store
        .renewLease(id, this.instanceId, lockedUntil, now)
        .then((renewed) => {
          if (!renewed) {
            this.logger?.warn(
              { id, instanceId: this.instanceId },
              `${this.name} background job lease renewal skipped because lease was lost`,
            );
            onLeaseLost();
          }
        })
        .catch((err) => {
          this.logger?.error(
            { err, id },
            `${this.name} background job lease renewal failed`,
          );
        })
        .finally(() => {
          renewInFlight = false;
        });
    }, renewIntervalMs);

    return () => clearInterval(interval);
  }

  private async completeJob(
    job: AcquiredBackgroundJob,
    err?: unknown,
  ): Promise<void> {
    const now = new Date();
    const completed =
      err === undefined
        ? await this.store.completeJobSuccess({
            id: job.id,
            instanceId: this.instanceId,
            now,
          })
        : await this.store.completeJobFailure({
            id: job.id,
            instanceId: this.instanceId,
            now,
            attemptCount: job.attemptCount,
            retryAt:
              job.attemptCount < job.maxAttempts
                ? new Date(now.getTime() + this.retryDelayMs)
                : null,
            error: errorToMessage(err),
          });

    if (!completed) {
      this.logger?.warn(
        { id: job.id, instanceId: this.instanceId },
        `${this.name} background job completion skipped because lease was lost`,
      );
    }
  }
}

export function getDistributedSchedulerNextRunAt(
  cron: string,
  from: Date,
): Date {
  return getNextCronRunAt(cron, from);
}
