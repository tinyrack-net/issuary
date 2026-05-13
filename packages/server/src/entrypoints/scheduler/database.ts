import os from 'node:os';
import { BackgroundJobEntitySchema } from '../../entities/background-job.entity.ts';
import { SchedulerJobEntitySchema } from '../../entities/scheduler-job.entity.ts';
import type {
  JobPayload,
  SchedulerConfig,
  SchedulerConfigResolver,
  SchedulerRuntimeConfig,
} from '../../lib/config/index.ts';
import type { MikroService } from '../../services/mikro.service.ts';
import {
  type AcquiredBackgroundJob,
  type AcquiredSchedulerJob,
  type BackgroundJobCompletionInput,
  type BackgroundJobEnqueueInput,
  type BackgroundJobFailureCompletionInput,
  DistributedBackgroundJobRunner,
  type DistributedBackgroundJobStore,
  DistributedSchedulerRunner,
  type DistributedSchedulerStore,
  getDistributedSchedulerNextRunAt,
  type PersistedSchedulerJobDefinition,
  type SchedulerCompletionInput,
  type SchedulerFailureCompletionInput,
} from './distributed-runner.ts';

const DEFAULT_CLEANUP_CRON = '0 2 * * *';
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_LOCK_TTL_MS = 60000;
const DEFAULT_BACKGROUND_RETRY_DELAY_MS = 1000;
const DEFAULT_BACKGROUND_MAX_ATTEMPTS = 3;
const MAX_ERROR_LENGTH = 2000;

export interface DatabaseSchedulerOptions {
  cleanupCron?: string | undefined;
  pollIntervalMs?: number | undefined;
  lockTtlMs?: number | undefined;
  backgroundRetryDelayMs?: number | undefined;
  backgroundMaxAttempts?: number | undefined;
  instanceId?: string | undefined;
}

export interface BoundDatabaseSchedulerOptions
  extends DatabaseSchedulerOptions {
  mikro: MikroService;
}

interface ResolvedDatabaseSchedulerOptions {
  cleanupCron: string;
  pollIntervalMs: number;
  lockTtlMs: number;
  backgroundRetryDelayMs: number;
  backgroundMaxAttempts: number;
  instanceId: string;
}

function createInstanceId(instanceId: string | undefined): string {
  return instanceId ?? `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;
}

function resolvePositiveNumber(
  name: string,
  value: number | undefined,
  defaultValue: number,
): number {
  const resolved = value ?? defaultValue;

  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return resolved;
}

function resolvePositiveInteger(
  name: string,
  value: number | undefined,
  defaultValue: number,
): number {
  const resolved = resolvePositiveNumber(name, value, defaultValue);

  if (!Number.isInteger(resolved)) {
    throw new Error(`${name} must be a positive integer`);
  }

  return resolved;
}

function errorToMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, MAX_ERROR_LENGTH);
}

function resolveOptions(
  options: DatabaseSchedulerOptions,
): ResolvedDatabaseSchedulerOptions {
  return {
    cleanupCron: options.cleanupCron ?? DEFAULT_CLEANUP_CRON,
    pollIntervalMs: resolvePositiveNumber(
      'pollIntervalMs',
      options.pollIntervalMs,
      DEFAULT_POLL_INTERVAL_MS,
    ),
    lockTtlMs: resolvePositiveNumber(
      'lockTtlMs',
      options.lockTtlMs,
      DEFAULT_LOCK_TTL_MS,
    ),
    backgroundRetryDelayMs: resolvePositiveNumber(
      'backgroundRetryDelayMs',
      options.backgroundRetryDelayMs,
      DEFAULT_BACKGROUND_RETRY_DELAY_MS,
    ),
    backgroundMaxAttempts: resolvePositiveInteger(
      'backgroundMaxAttempts',
      options.backgroundMaxAttempts,
      DEFAULT_BACKGROUND_MAX_ATTEMPTS,
    ),
    instanceId: createInstanceId(options.instanceId),
  };
}

class DatabaseSchedulerStore implements DistributedSchedulerStore {
  private readonly mikro: MikroService;

  constructor(mikro: MikroService) {
    this.mikro = mikro;
  }

  async reconcileJobs(
    jobs: readonly PersistedSchedulerJobDefinition[],
    now: Date,
  ): Promise<void> {
    const em = this.mikro.em.fork();
    const repo = em.getRepository(SchedulerJobEntitySchema);
    const jobIds = jobs.map((job) => job.id);

    for (const job of jobs) {
      const existing = await repo.findOne({ id: job.id });
      const nextRunAt = getDistributedSchedulerNextRunAt(job.cron, now);
      const shouldResetNextRunAt =
        !existing?.nextRunAt || existing.cron !== job.cron;

      await em.upsert(
        SchedulerJobEntitySchema,
        {
          id: job.id,
          name: job.name,
          enabled: true,
          cron: job.cron,
          nextRunAt: shouldResetNextRunAt ? nextRunAt : existing.nextRunAt,
          created_at: now,
          updated_at: now,
        },
        {
          onConflictFields: ['id'],
          onConflictAction: 'merge',
          onConflictExcludeFields: ['id', 'created_at'],
        },
      );
    }

    const staleJobFilter = jobIds.length > 0 ? { id: { $nin: jobIds } } : {};
    await repo.nativeUpdate(staleJobFilter, { enabled: false });
  }

  async acquireDueJob(
    now: Date,
    lockedUntil: Date,
    instanceId: string,
  ): Promise<AcquiredSchedulerJob | null> {
    const em = this.mikro.em.fork();
    const repo = em.getRepository(SchedulerJobEntitySchema);
    const candidate = await repo.findOne(
      {
        enabled: true,
        nextRunAt: { $lte: now },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
      },
      { orderBy: { nextRunAt: 'ASC' } },
    );

    if (!candidate) {
      return null;
    }

    const updated = await repo.nativeUpdate(
      {
        id: candidate.id,
        enabled: true,
        nextRunAt: { $lte: now },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
      },
      {
        lockedBy: instanceId,
        lockedUntil,
        lastRunAt: now,
      },
    );

    if (updated !== 1) {
      return null;
    }

    return {
      id: candidate.id,
      cron: candidate.cron,
      runCount: candidate.runCount,
      failureCount: candidate.failureCount,
    };
  }

  async renewLease(
    jobId: string,
    instanceId: string,
    lockedUntil: Date,
  ): Promise<boolean> {
    const em = this.mikro.em.fork();
    const repo = em.getRepository(SchedulerJobEntitySchema);
    const updated = await repo.nativeUpdate(
      { id: jobId, lockedBy: instanceId },
      { lockedUntil },
    );

    return updated === 1;
  }

  async completeJobSuccess(input: SchedulerCompletionInput): Promise<boolean> {
    const em = this.mikro.em.fork();
    const repo = em.getRepository(SchedulerJobEntitySchema);
    const updated = await repo.nativeUpdate(
      { id: input.jobId, lockedBy: input.instanceId },
      {
        lockedBy: null,
        lockedUntil: null,
        nextRunAt: input.nextRunAt,
        runCount: input.runCount,
        lastSuccessAt: input.now,
      },
    );

    return updated === 1;
  }

  async completeJobFailure(
    input: SchedulerFailureCompletionInput,
  ): Promise<boolean> {
    const em = this.mikro.em.fork();
    const repo = em.getRepository(SchedulerJobEntitySchema);
    const updated = await repo.nativeUpdate(
      { id: input.jobId, lockedBy: input.instanceId },
      {
        lockedBy: null,
        lockedUntil: null,
        nextRunAt: input.nextRunAt,
        runCount: input.runCount,
        lastErrorAt: input.now,
        lastError: input.error,
        failureCount: input.failureCount,
      },
    );

    return updated === 1;
  }

  async findNextRunAt(): Promise<Date | null> {
    const em = this.mikro.em.fork();
    const repo = em.getRepository(SchedulerJobEntitySchema);
    const next = await repo.findOne(
      { enabled: true, nextRunAt: { $ne: null } },
      { orderBy: { nextRunAt: 'ASC' } },
    );

    return next?.nextRunAt ?? null;
  }
}

class DatabaseBackgroundJobStore implements DistributedBackgroundJobStore {
  private readonly mikro: MikroService;

  constructor(mikro: MikroService) {
    this.mikro = mikro;
  }

  async enqueue(input: BackgroundJobEnqueueInput): Promise<string> {
    const em = this.mikro.em.fork();
    const id = crypto.randomUUID();
    const job = em.create(BackgroundJobEntitySchema, {
      id,
      jobId: input.jobId,
      payload: JSON.stringify(input.payload),
      status: 'pending',
      availableAt: input.availableAt,
      lockedBy: null,
      lockedUntil: null,
      attemptCount: 0,
      maxAttempts: input.maxAttempts,
      lastError: null,
      completedAt: null,
      created_at: input.now,
      updated_at: input.now,
    });

    em.persist(job);
    await em.flush();

    return id;
  }

  async acquireDueJob(
    now: Date,
    lockedUntil: Date,
    instanceId: string,
  ): Promise<AcquiredBackgroundJob | null> {
    const em = this.mikro.em.fork();
    const repo = em.getRepository(BackgroundJobEntitySchema);
    const eligibleFilter = {
      $or: [
        {
          status: 'pending',
          availableAt: { $lte: now },
        },
        {
          status: 'running',
          lockedUntil: { $lte: now },
        },
      ],
    };
    while (true) {
      const candidate = await repo.findOne(eligibleFilter, {
        orderBy: { availableAt: 'ASC' },
      });

      if (!candidate) {
        return null;
      }

      if (
        candidate.status === 'running' &&
        candidate.attemptCount >= candidate.maxAttempts
      ) {
        await repo.nativeUpdate(
          { id: candidate.id, ...eligibleFilter },
          {
            status: 'failed',
            availableAt: now,
            lockedBy: null,
            lockedUntil: null,
            lastError: 'Background job exceeded maximum attempts',
            completedAt: now,
          },
        );

        continue;
      }

      const attemptCount = candidate.attemptCount + 1;
      const updated = await repo.nativeUpdate(
        { id: candidate.id, ...eligibleFilter },
        {
          status: 'running',
          lockedBy: instanceId,
          lockedUntil,
          attemptCount,
        },
      );

      if (updated !== 1) {
        return null;
      }

      let payload: JobPayload;
      try {
        payload = JSON.parse(candidate.payload);
      } catch (err) {
        await repo.nativeUpdate(
          { id: candidate.id, lockedBy: instanceId, status: 'running' },
          {
            status: 'failed',
            availableAt: now,
            lockedBy: null,
            lockedUntil: null,
            attemptCount,
            lastError: errorToMessage(err),
            completedAt: now,
          },
        );

        return null;
      }

      return {
        id: candidate.id,
        jobId: candidate.jobId,
        payload,
        attemptCount,
        maxAttempts: candidate.maxAttempts,
      };
    }
  }

  async renewLease(
    id: string,
    instanceId: string,
    lockedUntil: Date,
  ): Promise<boolean> {
    const em = this.mikro.em.fork();
    const repo = em.getRepository(BackgroundJobEntitySchema);
    const updated = await repo.nativeUpdate(
      { id, lockedBy: instanceId, status: 'running' },
      { lockedUntil },
    );

    return updated === 1;
  }

  async completeJobSuccess(
    input: BackgroundJobCompletionInput,
  ): Promise<boolean> {
    const em = this.mikro.em.fork();
    const repo = em.getRepository(BackgroundJobEntitySchema);
    const updated = await repo.nativeUpdate(
      { id: input.id, lockedBy: input.instanceId, status: 'running' },
      {
        status: 'succeeded',
        lockedBy: null,
        lockedUntil: null,
        completedAt: input.now,
      },
    );

    return updated === 1;
  }

  async completeJobFailure(
    input: BackgroundJobFailureCompletionInput,
  ): Promise<boolean> {
    const em = this.mikro.em.fork();
    const repo = em.getRepository(BackgroundJobEntitySchema);
    const updated = await repo.nativeUpdate(
      { id: input.id, lockedBy: input.instanceId, status: 'running' },
      {
        status: input.retryAt ? 'pending' : 'failed',
        availableAt: input.retryAt ?? input.now,
        lockedBy: null,
        lockedUntil: null,
        attemptCount: input.attemptCount,
        lastError: input.error,
        completedAt: input.retryAt ? null : input.now,
      },
    );

    return updated === 1;
  }
}

function createDatabaseSchedulerConfig(
  options: ResolvedDatabaseSchedulerOptions,
  mikro: MikroService,
): SchedulerConfig {
  return {
    cleanupCron: options.cleanupCron,
    async start({ scheduledJobs, backgroundJobs, logger }) {
      const scheduledRunner = new DistributedSchedulerRunner({
        name: 'Database',
        pollIntervalMs: options.pollIntervalMs,
        lockTtlMs: options.lockTtlMs,
        instanceId: options.instanceId,
        jobs: scheduledJobs,
        logger,
        store: new DatabaseSchedulerStore(mikro),
      });
      const backgroundRunner = new DistributedBackgroundJobRunner({
        name: 'Database',
        pollIntervalMs: options.pollIntervalMs,
        lockTtlMs: options.lockTtlMs,
        retryDelayMs: options.backgroundRetryDelayMs,
        maxAttempts: options.backgroundMaxAttempts,
        instanceId: options.instanceId,
        jobs: backgroundJobs,
        logger,
        store: new DatabaseBackgroundJobStore(mikro),
      });
      const scheduledHandle = await scheduledRunner.start();
      const backgroundHandle = backgroundRunner.start();

      return {
        stop: async () => {
          await backgroundHandle.stop();
          await scheduledHandle.stop();
        },
        getNextRunAt: () => scheduledHandle.getNextRunAt?.() ?? null,
        enqueue: async (enqueueOptions) => {
          if (!backgroundHandle.enqueue) {
            throw new Error(
              'Background jobs require a durable scheduler backend',
            );
          }

          return backgroundHandle.enqueue(enqueueOptions);
        },
      };
    },
  };
}

function hasBoundMikro(
  options: DatabaseSchedulerOptions | BoundDatabaseSchedulerOptions,
): options is BoundDatabaseSchedulerOptions {
  return 'mikro' in options;
}

export function database(
  options: BoundDatabaseSchedulerOptions,
): SchedulerConfig;
export function database(
  options?: DatabaseSchedulerOptions,
): SchedulerConfigResolver;
export function database(
  options: DatabaseSchedulerOptions | BoundDatabaseSchedulerOptions = {},
): SchedulerRuntimeConfig {
  const resolved = resolveOptions(options);

  if (hasBoundMikro(options)) {
    return createDatabaseSchedulerConfig(resolved, options.mikro);
  }

  return ({ mikro }) => createDatabaseSchedulerConfig(resolved, mikro);
}
