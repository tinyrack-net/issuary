import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SchedulerConfig } from '#backend/lib/config/index.js';
import type { CleanupSummary } from '#backend/services/cleanup.service.js';
import type { ServiceContainer } from '#backend/services/container.js';
import { createTestApp } from '#backend/test-utils/index.js';
import { MINIMAL_TEST_CONFIG } from '#backend/test-utils/setup.js';

interface FakeSchedulerDriver {
  config: SchedulerConfig;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  triggerCleanup: () => Promise<void>;
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
  let runCleanupCallback: (() => Promise<void>) | undefined;
  const nextRunAt = options?.nextRunAt ?? null;

  const stop = vi.fn(() => {});
  const start = vi.fn(
    async ({ runCleanup }: { runCleanup: () => Promise<void> }) => {
      runCleanupCallback = runCleanup;

      return {
        stop,
        getNextRunAt: () => nextRunAt,
      };
    },
  );

  return {
    config: {
      start,
    },
    start,
    stop,
    async triggerCleanup() {
      if (!runCleanupCallback) {
        throw new Error('Scheduler was not started');
      }

      await runCleanupCallback();
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
      ({ services, cleanup } = await createTestApp({
        config: MINIMAL_TEST_CONFIG,
      }));
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
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: driver.config,
        },
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

      await driver.triggerCleanup();

      expect(runAllSpy).toHaveBeenCalledWith({
        dryRun: false,
        verbose: false,
      });
    });

    it('swallows cleanup failures and keeps the scheduler running', async () => {
      vi.spyOn(services.cleanupService, 'runAll').mockRejectedValue(
        new Error('cleanup failed'),
      );

      await expect(driver.triggerCleanup()).resolves.toBeUndefined();
      expect(services.scheduler.isRunning()).toBe(true);
    });

    it('stops the scheduler handle during app cleanup', async () => {
      await cleanup();

      expect(driver.stop).toHaveBeenCalledTimes(1);
      expect(services.scheduler.isRunning()).toBe(false);

      cleanup = async () => {};
    });
  });
});
