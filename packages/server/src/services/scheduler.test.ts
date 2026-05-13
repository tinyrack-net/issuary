import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BackgroundJobConfig,
  ScheduledJobConfig,
  SchedulerConfig,
} from '../lib/config/index.ts';
import { createTestApp } from '../test-utils/index.ts';
import { MINIMAL_TEST_CONFIG } from '../test-utils/setup.ts';
import type { CleanupSummary } from './cleanup.service.ts';
import type { ServiceContainer } from './container.ts';

interface FakeSchedulerDriver {
  config: SchedulerConfig;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  enqueue: ReturnType<typeof vi.fn>;
  triggerJob: (id: string) => Promise<void>;
}

function createCleanupSummary(): CleanupSummary {
  return {
    tasks: [],
    totalDeleted: 0,
    totalSkipped: 0,
    totalFailed: 0,
    totalDurationMs: 0,
  };
}

function createFakeSchedulerDriver(options?: {
  nextRunAt?: Date | null;
}): FakeSchedulerDriver {
  let scheduledJobs: readonly ScheduledJobConfig[] = [];
  let backgroundJobs: readonly BackgroundJobConfig[] = [];
  const nextRunAt = options?.nextRunAt ?? null;

  const stop = vi.fn(() => {});
  const enqueue = vi.fn(async ({ jobId }: { jobId: string }) => {
    const job = backgroundJobs.find(
      (backgroundJob) => backgroundJob.id === jobId,
    );
    if (!job) {
      throw new Error(`Background job was not registered: ${jobId}`);
    }

    return 'background-job-id';
  });
  const start = vi.fn(
    async ({
      scheduledJobs: startedScheduledJobs,
      backgroundJobs: startedBackgroundJobs,
    }: {
      scheduledJobs: readonly ScheduledJobConfig[];
      backgroundJobs: readonly BackgroundJobConfig[];
    }) => {
      scheduledJobs = startedScheduledJobs;
      backgroundJobs = startedBackgroundJobs;

      return {
        stop,
        getNextRunAt: () => nextRunAt,
        enqueue,
      };
    },
  );

  return {
    config: {
      start,
    },
    start,
    stop,
    enqueue,
    async triggerJob(id: string) {
      const job = scheduledJobs.find((scheduledJob) => scheduledJob.id === id);
      if (!job) {
        throw new Error(`Scheduler job was not registered: ${id}`);
      }

      await job.handler({});
    },
  };
}

describe('scheduler service', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
    vi.restoreAllMocks();
  });

  describe('when scheduler is omitted', () => {
    beforeEach(async () => {
      ({ services, cleanup } = await createTestApp(MINIMAL_TEST_CONFIG));
    });

    it('does not start a cleanup job', () => {
      expect(services.scheduler.isRunning()).toBe(false);
      expect(services.scheduler.getNextRunAt()).toBeNull();
    });
  });

  describe('when scheduler adapter is configured', () => {
    let driver: FakeSchedulerDriver;

    beforeEach(async () => {
      driver = createFakeSchedulerDriver({
        nextRunAt: new Date('2026-03-13T02:00:00.000Z'),
      });

      ({ services, cleanup } = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        scheduler: driver.config,
      }));
    });

    it('starts the scheduler during app creation', () => {
      expect(driver.start).toHaveBeenCalledTimes(1);
      expect(services.scheduler.isRunning()).toBe(true);
      expect(services.scheduler.getNextRunAt()).toEqual(
        new Date('2026-03-13T02:00:00.000Z'),
      );
    });

    it('invokes cleanup through the scheduler callback', async () => {
      const runAllSpy = vi
        .spyOn(services.cleanupService, 'runAll')
        .mockResolvedValue(createCleanupSummary());

      await driver.triggerJob('cleanup.run-all');

      expect(runAllSpy).toHaveBeenCalledWith({
        dryRun: false,
        verbose: false,
      });
    });

    it('propagates cleanup failures so adapters can record them', async () => {
      vi.spyOn(services.cleanupService, 'runAll').mockRejectedValue(
        new Error('cleanup failed'),
      );

      await expect(driver.triggerJob('cleanup.run-all')).rejects.toThrow(
        'cleanup failed',
      );
      expect(services.scheduler.isRunning()).toBe(true);
    });

    it('stops the scheduler handle during app cleanup', async () => {
      await cleanup();

      expect(driver.stop).toHaveBeenCalledTimes(1);
      expect(services.scheduler.isRunning()).toBe(false);

      cleanup = async () => {};
    });

    it('delegates background job enqueue to the scheduler handle', async () => {
      await expect(
        services.scheduler.enqueue('unknown.job', { value: 'test' }),
      ).rejects.toThrow('Background job was not registered: unknown.job');

      expect(driver.enqueue).toHaveBeenCalledWith({
        jobId: 'unknown.job',
        payload: { value: 'test' },
        runAt: undefined,
      });
    });
  });
});
