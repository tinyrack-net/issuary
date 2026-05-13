import { afterEach, describe, expect, test, vi } from 'vitest';
import { BackgroundJobEntitySchema } from '../../entities/background-job.entity.ts';
import { SchedulerJobEntitySchema } from '../../entities/scheduler-job.entity.ts';
import type { SchedulerHandle } from '../../lib/config/index.ts';
import type { ServiceContainer } from '../../services/container.ts';
import { createTestApp } from '../../test-utils/index.ts';
import { MINIMAL_TEST_CONFIG } from '../../test-utils/setup.ts';
import { database } from './database.ts';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function createDeferred(): Deferred {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe('database scheduler factory', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
    vi.restoreAllMocks();
  });

  async function createScheduledServices(): Promise<ServiceContainer> {
    const result = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      scheduler: database({
        cleanupCron: '* * * * *',
        pollIntervalMs: 10,
        lockTtlMs: 1000,
        instanceId: 'test-instance',
      }),
    });
    cleanup = result.cleanup;
    return result.services;
  }

  async function findCleanupJob(services: ServiceContainer) {
    return services.mikro.em
      .fork()
      .getRepository(SchedulerJobEntitySchema)
      .findOne({ id: 'cleanup.run-all' });
  }

  async function findJob(services: ServiceContainer, id: string) {
    return services.mikro.em
      .fork()
      .getRepository(SchedulerJobEntitySchema)
      .findOne({ id });
  }

  async function findBackgroundJob(services: ServiceContainer, id: string) {
    return services.mikro.em
      .fork()
      .getRepository(BackgroundJobEntitySchema)
      .findOne({ id });
  }

  test('creates a persistent cleanup job on startup', async () => {
    const services = await createScheduledServices();

    const job = await findCleanupJob(services);

    expect(job).toMatchObject({
      id: 'cleanup.run-all',
      name: 'Run cleanup tasks',
      enabled: true,
      cron: '* * * * *',
      runCount: 0,
      failureCount: 0,
    });
    expect(job?.nextRunAt).toBeInstanceOf(Date);
  });

  test('rejects invalid runtime interval options', () => {
    expect(() => database({ pollIntervalMs: 0 })).toThrow(
      'pollIntervalMs must be a positive number',
    );
    expect(() => database({ lockTtlMs: -1 })).toThrow(
      'lockTtlMs must be a positive number',
    );
    expect(() => database({ backgroundRetryDelayMs: Number.NaN })).toThrow(
      'backgroundRetryDelayMs must be a positive number',
    );
    expect(() => database({ backgroundMaxAttempts: 0 })).toThrow(
      'backgroundMaxAttempts must be a positive number',
    );
    expect(() => database({ backgroundMaxAttempts: 1.5 })).toThrow(
      'backgroundMaxAttempts must be a positive integer',
    );
  });

  test('rejects invalid cleanup cron expressions', () => {
    expect(() => database({ cleanupCron: 'not a cron' })).toThrow(
      'Invalid cron expression',
    );
  });

  test('runs a due cleanup job once and advances the schedule', async () => {
    const services = await createScheduledServices();
    const runAllSpy = vi
      .spyOn(services.cleanupService, 'runAll')
      .mockResolvedValue({
        tasks: [],
        totalDeleted: 0,
        totalSkipped: 0,
        totalFailed: 0,
        totalDurationMs: 0,
      });

    await services.mikro.schedulerJob.nativeUpdate(
      { id: 'cleanup.run-all' },
      { nextRunAt: new Date(Date.now() - 1000) },
    );

    await vi.waitFor(async () => {
      const job = await findCleanupJob(services);
      expect(job?.runCount).toBe(1);
    });

    const job = await findCleanupJob(services);
    expect(runAllSpy).toHaveBeenCalledTimes(1);
    expect(job?.lockedBy).toBeNull();
    expect(job?.lockedUntil).toBeNull();
    expect(job?.lastSuccessAt).toBeInstanceOf(Date);
    expect(job?.nextRunAt?.getTime()).toBeGreaterThan(Date.now());
  });

  test('records cleanup failures in the persistent job state', async () => {
    const services = await createScheduledServices();
    vi.spyOn(services.cleanupService, 'runAll').mockRejectedValue(
      new Error('cleanup failed'),
    );

    await services.mikro.schedulerJob.nativeUpdate(
      { id: 'cleanup.run-all' },
      { nextRunAt: new Date(Date.now() - 1000) },
    );

    await vi.waitFor(async () => {
      const job = await findCleanupJob(services);
      expect(job?.runCount).toBe(1);
    });

    const job = await findCleanupJob(services);
    expect(job?.lockedBy).toBeNull();
    expect(job?.lockedUntil).toBeNull();
    expect(job?.lastSuccessAt).toBeNull();
    expect(job?.lastErrorAt).toBeInstanceOf(Date);
    expect(job?.lastError).toContain('cleanup failed');
    expect(job?.failureCount).toBe(1);
  });

  test('reconciles jobs idempotently during concurrent startup', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const handler = vi.fn(async () => {});
    const schedulerA = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 1000,
      lockTtlMs: 1000,
      instanceId: 'startup-a',
      mikro: services.mikro,
    });
    const schedulerB = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 1000,
      lockTtlMs: 1000,
      instanceId: 'startup-b',
      mikro: services.mikro,
    });
    const handles = await Promise.all([
      schedulerA.start({
        scheduledJobs: [
          {
            id: 'startup-test',
            name: 'Startup Test',
            schedule: { type: 'cron', expression: '* * * * *' },
            handler: async () => handler(),
          },
        ],
        backgroundJobs: [],
      }),
      schedulerB.start({
        scheduledJobs: [
          {
            id: 'startup-test',
            name: 'Startup Test',
            schedule: { type: 'cron', expression: '* * * * *' },
            handler: async () => handler(),
          },
        ],
        backgroundJobs: [],
      }),
    ]);

    try {
      const jobs = await services.mikro.em
        .fork()
        .getRepository(SchedulerJobEntitySchema)
        .find({ id: 'startup-test' });

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({
        id: 'startup-test',
        name: 'Startup Test',
        enabled: true,
      });
    } finally {
      await Promise.all(handles.map((handle) => handle.stop()));
    }
  });

  test('disables stale scheduled jobs when no scheduled jobs are registered', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const scheduler = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 1000,
      lockTtlMs: 1000,
      instanceId: 'empty-reconcile',
      mikro: services.mikro,
    });
    const initialHandle = await scheduler.start({
      scheduledJobs: [
        {
          id: 'stale-empty-test',
          name: 'Stale Empty Test',
          schedule: { type: 'cron', expression: '* * * * *' },
          handler: async () => {},
        },
      ],
      backgroundJobs: [],
    });
    await initialHandle.stop();

    const emptyHandle = await scheduler.start({
      scheduledJobs: [],
      backgroundJobs: [],
    });

    try {
      const job = await findJob(services, 'stale-empty-test');
      expect(job?.enabled).toBe(false);
    } finally {
      await emptyHandle.stop();
    }
  });

  test('runs a due job once when two instances contend for it', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const started = createDeferred();
    const release = createDeferred();
    const handler = vi.fn(async () => {
      started.resolve();
      await release.promise;
    });
    const schedulerA = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 5,
      lockTtlMs: 1000,
      instanceId: 'contend-a',
      mikro: services.mikro,
    });
    const schedulerB = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 5,
      lockTtlMs: 1000,
      instanceId: 'contend-b',
      mikro: services.mikro,
    });
    const handleA = await schedulerA.start({
      scheduledJobs: [
        {
          id: 'contend-test',
          name: 'Contend Test',
          schedule: { type: 'cron', expression: '* * * * *' },
          handler: async () => handler(),
        },
      ],
      backgroundJobs: [],
    });
    const handleB = await schedulerB.start({
      scheduledJobs: [
        {
          id: 'contend-test',
          name: 'Contend Test',
          schedule: { type: 'cron', expression: '* * * * *' },
          handler: async () => handler(),
        },
      ],
      backgroundJobs: [],
    });

    try {
      await services.mikro.schedulerJob.nativeUpdate(
        { id: 'contend-test' },
        { nextRunAt: new Date(Date.now() - 1000) },
      );
      await started.promise;
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      release.resolve();
      await Promise.all([handleA.stop(), handleB.stop()]);
    }

    const job = await findJob(services, 'contend-test');
    expect(job?.runCount).toBe(1);
  });

  test('does not record success when completion lost the lease', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const started = createDeferred();
    const release = createDeferred();
    const handler = vi.fn(async () => {
      started.resolve();
      await release.promise;
    });
    const scheduler = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 5,
      lockTtlMs: 10000,
      instanceId: 'stale-success-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [
        {
          id: 'stale-success',
          name: 'Stale Success',
          schedule: { type: 'cron', expression: '* * * * *' },
          handler: async () => handler(),
        },
      ],
      backgroundJobs: [],
    });

    try {
      await services.mikro.schedulerJob.nativeUpdate(
        { id: 'stale-success' },
        { nextRunAt: new Date(Date.now() - 1000) },
      );
      await started.promise;
      const takeoverUntil = new Date(Date.now() + 60000);
      await services.mikro.schedulerJob.nativeUpdate(
        { id: 'stale-success' },
        { lockedBy: 'stale-success-b', lockedUntil: takeoverUntil },
      );

      release.resolve();
      await handle.stop();
    } finally {
      release.resolve();
    }

    const job = await findJob(services, 'stale-success');
    expect(job?.lockedBy).toBe('stale-success-b');
    expect(job?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect(job?.runCount).toBe(0);
    expect(job?.lastSuccessAt).toBeNull();
  });

  test('does not record failure when completion lost the lease', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const started = createDeferred();
    const release = createDeferred();
    const handler = vi.fn(async () => {
      started.resolve();
      await release.promise;
      throw new Error('stale failure');
    });
    const scheduler = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 5,
      lockTtlMs: 10000,
      instanceId: 'stale-failure-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [
        {
          id: 'stale-failure',
          name: 'Stale Failure',
          schedule: { type: 'cron', expression: '* * * * *' },
          handler: async () => handler(),
        },
      ],
      backgroundJobs: [],
    });

    try {
      await services.mikro.schedulerJob.nativeUpdate(
        { id: 'stale-failure' },
        { nextRunAt: new Date(Date.now() - 1000) },
      );
      await started.promise;
      const takeoverUntil = new Date(Date.now() + 60000);
      await services.mikro.schedulerJob.nativeUpdate(
        { id: 'stale-failure' },
        { lockedBy: 'stale-failure-b', lockedUntil: takeoverUntil },
      );

      release.resolve();
      await handle.stop();
    } finally {
      release.resolve();
    }

    const job = await findJob(services, 'stale-failure');
    expect(job?.lockedBy).toBe('stale-failure-b');
    expect(job?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect(job?.runCount).toBe(0);
    expect(job?.failureCount).toBe(0);
    expect(job?.lastErrorAt).toBeNull();
    expect(job?.lastError).toBeNull();
  });

  test('does not overwrite a reconciled cron schedule with stale completion data', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const started = createDeferred();
    const release = createDeferred();
    const handler = vi.fn(async () => {
      started.resolve();
      await release.promise;
    });
    const scheduler = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 5,
      lockTtlMs: 10000,
      instanceId: 'cron-change-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [
        {
          id: 'cron-change',
          name: 'Cron Change',
          schedule: { type: 'cron', expression: '* * * * *' },
          handler: async () => handler(),
        },
      ],
      backgroundJobs: [],
    });

    const reconciledNextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      await services.mikro.schedulerJob.nativeUpdate(
        { id: 'cron-change' },
        { nextRunAt: new Date(Date.now() - 1000) },
      );
      await started.promise;
      await services.mikro.schedulerJob.nativeUpdate(
        { id: 'cron-change' },
        {
          cron: '0 0 * * *',
          nextRunAt: reconciledNextRunAt,
        },
      );

      release.resolve();
      await handle.stop();
    } finally {
      release.resolve();
    }

    const job = await findJob(services, 'cron-change');
    expect(job?.cron).toBe('0 0 * * *');
    expect(job?.nextRunAt?.getTime()).toBe(reconciledNextRunAt.getTime());
    expect(job?.runCount).toBe(0);
    expect(job?.lastSuccessAt).toBeNull();
  });

  test('does not record scheduled completion after its lease expires', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const started = createDeferred();
    const release = createDeferred();
    const handler = vi.fn(async () => {
      started.resolve();
      await release.promise;
    });
    const scheduler = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 5,
      lockTtlMs: 10000,
      instanceId: 'expired-completion-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [
        {
          id: 'expired-completion',
          name: 'Expired Completion',
          schedule: { type: 'cron', expression: '* * * * *' },
          handler: async () => handler(),
        },
      ],
      backgroundJobs: [],
    });

    try {
      await services.mikro.schedulerJob.nativeUpdate(
        { id: 'expired-completion' },
        { nextRunAt: new Date(Date.now() - 1000) },
      );
      await started.promise;
      await services.mikro.schedulerJob.nativeUpdate(
        { id: 'expired-completion' },
        { lockedUntil: new Date(Date.now() - 1000) },
      );

      release.resolve();
      await handle.stop();
    } finally {
      release.resolve();
    }

    const job = await findJob(services, 'expired-completion');
    expect(job?.lockedBy).toBe('expired-completion-a');
    expect(job?.runCount).toBe(0);
    expect(job?.lastSuccessAt).toBeNull();
  });

  test('renews leases so long-running jobs are not acquired twice', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const started = createDeferred();
    const release = createDeferred();
    const handler = vi.fn(async () => {
      started.resolve();
      await release.promise;
    });
    const schedulerA = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 5,
      lockTtlMs: 50,
      instanceId: 'lease-a',
      mikro: services.mikro,
    });
    const schedulerB = database({
      cleanupCron: '* * * * *',
      pollIntervalMs: 5,
      lockTtlMs: 50,
      instanceId: 'lease-b',
      mikro: services.mikro,
    });
    let handleA: SchedulerHandle | undefined;
    let handleB: SchedulerHandle | undefined;

    try {
      handleA = await schedulerA.start({
        scheduledJobs: [
          {
            id: 'lease-test',
            name: 'Lease Test',
            schedule: { type: 'cron', expression: '* * * * *' },
            handler: async () => handler(),
          },
        ],
        backgroundJobs: [],
      });
      await services.mikro.schedulerJob.nativeUpdate(
        { id: 'lease-test' },
        { nextRunAt: new Date(Date.now() - 1000) },
      );

      await started.promise;
      handleB = await schedulerB.start({
        scheduledJobs: [
          {
            id: 'lease-test',
            name: 'Lease Test',
            schedule: { type: 'cron', expression: '* * * * *' },
            handler: async () => handler(),
          },
        ],
        backgroundJobs: [],
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      release.resolve();
      if (handleB) {
        await handleB.stop();
      }
      if (handleA) {
        await handleA.stop();
      }
    }

    await vi.waitFor(async () => {
      const job = await services.mikro.em
        .fork()
        .getRepository(SchedulerJobEntitySchema)
        .findOne({ id: 'lease-test' });
      expect(job?.runCount).toBe(1);
    });
  });

  test('enqueues and runs a durable background job once', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const handler = vi.fn(async () => {});
    const scheduler = database({
      pollIntervalMs: 5,
      lockTtlMs: 1000,
      instanceId: 'background-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [],
      backgroundJobs: [
        {
          id: 'background-test',
          name: 'Background Test',
          handler,
        },
      ],
    });

    try {
      const id = await handle.enqueue?.({
        jobId: 'background-test',
        payload: { value: 'ok' },
      });
      if (!id) {
        throw new Error('Expected background job id');
      }

      await vi.waitFor(async () => {
        const job = await findBackgroundJob(services, id);
        expect(job?.status).toBe('succeeded');
      });

      const job = await findBackgroundJob(services, id);
      expect(job?.attemptCount).toBe(1);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ value: 'ok' }, expect.anything());
    } finally {
      await handle.stop();
    }
  });

  test('does not record background completion after its lease expires', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const started = createDeferred();
    const release = createDeferred();
    const handler = vi.fn(async () => {
      started.resolve();
      await release.promise;
    });
    const scheduler = database({
      pollIntervalMs: 5,
      lockTtlMs: 10000,
      instanceId: 'background-expired-completion-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [],
      backgroundJobs: [
        {
          id: 'background-expired-completion-test',
          name: 'Background Expired Completion Test',
          handler,
        },
      ],
    });

    try {
      const id = await handle.enqueue?.({
        jobId: 'background-expired-completion-test',
        payload: null,
      });
      if (!id) {
        throw new Error('Expected background job id');
      }

      await started.promise;
      await services.mikro.backgroundJob.nativeUpdate(
        { id },
        { lockedUntil: new Date(Date.now() - 1000) },
      );

      release.resolve();
      await handle.stop();

      const job = await findBackgroundJob(services, id);
      expect(job?.status).toBe('running');
      expect(job?.lockedBy).toBe('background-expired-completion-a');
      expect(job?.attemptCount).toBe(1);
      expect(job?.completedAt).toBeNull();
    } finally {
      release.resolve();
    }
  });

  test('records durable background job failures and stops retrying', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const scheduler = database({
      pollIntervalMs: 5,
      lockTtlMs: 1000,
      backgroundRetryDelayMs: 5,
      backgroundMaxAttempts: 2,
      instanceId: 'background-failure-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [],
      backgroundJobs: [
        {
          id: 'background-failure-test',
          name: 'Background Failure Test',
          handler: async () => {
            throw new Error('background failed');
          },
        },
      ],
    });

    try {
      const id = await handle.enqueue?.({
        jobId: 'background-failure-test',
        payload: null,
      });
      if (!id) {
        throw new Error('Expected background job id');
      }

      await vi.waitFor(async () => {
        const job = await findBackgroundJob(services, id);
        expect(job?.status).toBe('failed');
      });

      const job = await findBackgroundJob(services, id);
      expect(job?.attemptCount).toBe(2);
      expect(job?.lastError).toContain('background failed');
      expect(job?.completedAt).toBeInstanceOf(Date);
    } finally {
      await handle.stop();
    }
  });

  test('marks background jobs with invalid persisted payloads as failed', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const handler = vi.fn(async () => {});
    const scheduler = database({
      pollIntervalMs: 5,
      lockTtlMs: 1000,
      instanceId: 'background-invalid-payload-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [],
      backgroundJobs: [
        {
          id: 'background-invalid-payload-test',
          name: 'Background Invalid Payload Test',
          handler,
        },
      ],
    });

    try {
      const now = new Date();
      const id = crypto.randomUUID();
      const em = services.mikro.em.fork();
      const job = em.create(BackgroundJobEntitySchema, {
        id,
        jobId: 'background-invalid-payload-test',
        payload: '{invalid-json',
        status: 'pending',
        availableAt: now,
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        maxAttempts: 3,
        lastError: null,
        completedAt: null,
        created_at: now,
        updated_at: now,
      });
      em.persist(job);
      await em.flush();

      await vi.waitFor(async () => {
        const persistedJob = await findBackgroundJob(services, id);
        expect(persistedJob?.status).toBe('failed');
      });

      const persistedJob = await findBackgroundJob(services, id);
      expect(handler).not.toHaveBeenCalled();
      expect(persistedJob?.lockedBy).toBeNull();
      expect(persistedJob?.lockedUntil).toBeNull();
      expect(persistedJob?.attemptCount).toBe(1);
      expect(persistedJob?.lastError).toContain('JSON');
      expect(persistedJob?.completedAt).toBeInstanceOf(Date);
    } finally {
      await handle.stop();
    }
  });

  test('continues to due background jobs after invalid payloads', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const handler = vi.fn(async () => {});
    const now = new Date();
    const invalidId = crypto.randomUUID();
    const runnableId = crypto.randomUUID();
    const em = services.mikro.em.fork();
    em.persist(
      em.create(BackgroundJobEntitySchema, {
        id: invalidId,
        jobId: 'background-invalid-continue-test',
        payload: '{invalid-json',
        status: 'pending',
        availableAt: new Date(now.getTime() - 1000),
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        maxAttempts: 3,
        lastError: null,
        completedAt: null,
        created_at: now,
        updated_at: now,
      }),
    );
    em.persist(
      em.create(BackgroundJobEntitySchema, {
        id: runnableId,
        jobId: 'background-invalid-continue-test',
        payload: JSON.stringify({ value: 'next' }),
        status: 'pending',
        availableAt: now,
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        maxAttempts: 3,
        lastError: null,
        completedAt: null,
        created_at: now,
        updated_at: now,
      }),
    );
    await em.flush();

    const scheduler = database({
      pollIntervalMs: 1000,
      lockTtlMs: 1000,
      instanceId: 'background-invalid-continue-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [],
      backgroundJobs: [
        {
          id: 'background-invalid-continue-test',
          name: 'Background Invalid Continue Test',
          handler,
        },
      ],
    });

    try {
      await vi.waitFor(async () => {
        const invalid = await findBackgroundJob(services, invalidId);
        const runnable = await findBackgroundJob(services, runnableId);
        expect(invalid?.status).toBe('failed');
        expect(runnable?.status).toBe('succeeded');
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        { value: 'next' },
        expect.anything(),
      );
    } finally {
      await handle.stop();
    }
  });

  test('reclaims an expired running background job', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const handler = vi.fn(async () => {});
    const scheduler = database({
      pollIntervalMs: 5,
      lockTtlMs: 1000,
      instanceId: 'background-reclaim-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [],
      backgroundJobs: [
        {
          id: 'background-reclaim-test',
          name: 'Background Reclaim Test',
          handler,
        },
      ],
    });

    try {
      const id = await handle.enqueue?.({
        jobId: 'background-reclaim-test',
        payload: { value: 'reclaim' },
        runAt: new Date(Date.now() + 60000),
      });
      if (!id) {
        throw new Error('Expected background job id');
      }

      await services.mikro.backgroundJob.nativeUpdate(
        { id },
        {
          status: 'running',
          lockedBy: 'dead-worker',
          lockedUntil: new Date(Date.now() - 1000),
          attemptCount: 1,
        },
      );

      await vi.waitFor(async () => {
        const job = await findBackgroundJob(services, id);
        expect(job?.status).toBe('succeeded');
      });

      const job = await findBackgroundJob(services, id);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(job?.attemptCount).toBe(2);
      expect(job?.lockedBy).toBeNull();
      expect(job?.lockedUntil).toBeNull();
    } finally {
      await handle.stop();
    }
  });

  test('does not reclaim expired running background jobs after max attempts', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const handler = vi.fn(async () => {});
    const scheduler = database({
      pollIntervalMs: 5,
      lockTtlMs: 1000,
      instanceId: 'background-max-attempts-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [],
      backgroundJobs: [
        {
          id: 'background-max-attempts-test',
          name: 'Background Max Attempts Test',
          handler,
        },
      ],
    });

    try {
      const id = await handle.enqueue?.({
        jobId: 'background-max-attempts-test',
        payload: { value: 'expired' },
        runAt: new Date(Date.now() + 60000),
      });
      if (!id) {
        throw new Error('Expected background job id');
      }

      await services.mikro.backgroundJob.nativeUpdate(
        { id },
        {
          status: 'running',
          lockedBy: 'dead-worker',
          lockedUntil: new Date(Date.now() - 1000),
          attemptCount: 3,
          maxAttempts: 3,
        },
      );

      await vi.waitFor(async () => {
        const job = await findBackgroundJob(services, id);
        expect(job?.status).toBe('failed');
      });

      const job = await findBackgroundJob(services, id);
      expect(handler).not.toHaveBeenCalled();
      expect(job?.attemptCount).toBe(3);
      expect(job?.lockedBy).toBeNull();
      expect(job?.lockedUntil).toBeNull();
      expect(job?.lastError).toContain('maximum attempts');
      expect(job?.completedAt).toBeInstanceOf(Date);
    } finally {
      await handle.stop();
    }
  });

  test('continues to due background jobs after expiring exhausted jobs', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const handler = vi.fn(async () => {});
    const now = new Date();
    const exhaustedId = crypto.randomUUID();
    const runnableId = crypto.randomUUID();
    const em = services.mikro.em.fork();
    em.persist(
      em.create(BackgroundJobEntitySchema, {
        id: exhaustedId,
        jobId: 'background-head-of-line-test',
        payload: JSON.stringify(null),
        status: 'running',
        availableAt: new Date(now.getTime() - 2000),
        lockedBy: 'dead-worker',
        lockedUntil: new Date(now.getTime() - 1000),
        attemptCount: 3,
        maxAttempts: 3,
        lastError: null,
        completedAt: null,
        created_at: now,
        updated_at: now,
      }),
    );
    em.persist(
      em.create(BackgroundJobEntitySchema, {
        id: runnableId,
        jobId: 'background-head-of-line-test',
        payload: JSON.stringify({ value: 'next' }),
        status: 'pending',
        availableAt: now,
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        maxAttempts: 3,
        lastError: null,
        completedAt: null,
        created_at: now,
        updated_at: now,
      }),
    );
    await em.flush();

    const scheduler = database({
      pollIntervalMs: 1000,
      lockTtlMs: 1000,
      instanceId: 'background-head-of-line-a',
      mikro: services.mikro,
    });
    const handle = await scheduler.start({
      scheduledJobs: [],
      backgroundJobs: [
        {
          id: 'background-head-of-line-test',
          name: 'Background Head Of Line Test',
          handler,
        },
      ],
    });

    try {
      await vi.waitFor(async () => {
        const exhausted = await findBackgroundJob(services, exhaustedId);
        const runnable = await findBackgroundJob(services, runnableId);
        expect(exhausted?.status).toBe('failed');
        expect(runnable?.status).toBe('succeeded');
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        { value: 'next' },
        expect.anything(),
      );
    } finally {
      await handle.stop();
    }
  });

  test('reclaims an expired running background job once under contention', async () => {
    const result = await createTestApp(MINIMAL_TEST_CONFIG);
    cleanup = result.cleanup;
    const services = result.services;
    const started = createDeferred();
    const release = createDeferred();
    const handler = vi.fn(async () => {
      started.resolve();
      await release.promise;
    });
    const schedulerA = database({
      pollIntervalMs: 5,
      lockTtlMs: 1000,
      instanceId: 'background-contend-a',
      mikro: services.mikro,
    });
    const schedulerB = database({
      pollIntervalMs: 5,
      lockTtlMs: 1000,
      instanceId: 'background-contend-b',
      mikro: services.mikro,
    });
    const handleA = await schedulerA.start({
      scheduledJobs: [],
      backgroundJobs: [
        {
          id: 'background-contend-test',
          name: 'Background Contend Test',
          handler,
        },
      ],
    });
    const handleB = await schedulerB.start({
      scheduledJobs: [],
      backgroundJobs: [
        {
          id: 'background-contend-test',
          name: 'Background Contend Test',
          handler,
        },
      ],
    });

    try {
      const id = await handleA.enqueue?.({
        jobId: 'background-contend-test',
        payload: null,
        runAt: new Date(Date.now() + 60000),
      });
      if (!id) {
        throw new Error('Expected background job id');
      }

      await services.mikro.backgroundJob.nativeUpdate(
        { id },
        {
          status: 'running',
          lockedBy: 'dead-worker',
          lockedUntil: new Date(Date.now() - 1000),
          attemptCount: 1,
        },
      );

      await started.promise;
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      release.resolve();
      await Promise.all([handleA.stop(), handleB.stop()]);
    }
  });
});
