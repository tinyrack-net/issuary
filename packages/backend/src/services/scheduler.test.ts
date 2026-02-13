import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '@/server.js';
import { MINIMAL_TEST_CONFIG } from '@/test-utils/setup.js';
import type { ServiceContainer } from '@/types.js';

describe('scheduler plugin', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
    vi.restoreAllMocks();
  });

  describe('when scheduler is disabled', () => {
    beforeEach(async () => {
      ({ services, cleanup } = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: {
            enabled: false,
          },
        },
        skipListen: true,
      }));
    });

    it('should not start the cleanup job', () => {
      expect(services.scheduler).toBeDefined();
      expect(services.scheduler.cleanupJob).toBeNull();
    });

    it('should have scheduler available', () => {
      expect(services.scheduler).toBeDefined();
    });
  });

  describe('when scheduler is enabled', () => {
    beforeEach(async () => {
      ({ services, cleanup } = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: {
            enabled: true,
            cron: '0 2 * * *', // Daily at 2 AM
          },
        },
        skipListen: true,
      }));
    });

    it('should start the cleanup job', () => {
      expect(services.scheduler).toBeDefined();
      expect(services.scheduler.cleanupJob).not.toBeNull();
    });

    it('should have a scheduled next run time', () => {
      const nextRun = services.scheduler.cleanupJob?.nextRun();
      expect(nextRun).toBeDefined();
      expect(nextRun).toBeInstanceOf(Date);
    });

    it('should stop the job on cleanup', async () => {
      const job = services.scheduler.cleanupJob;
      expect(job?.isStopped()).toBe(false);

      await cleanup();

      expect(job?.isStopped()).toBe(true);

      // Prevent double cleanup in afterEach
      cleanup = async () => {};
    });
  });

  describe('with default config', () => {
    beforeEach(async () => {
      // Default config should have scheduler enabled
      ({ services, cleanup } = await createServer({
        config: MINIMAL_TEST_CONFIG,
        skipListen: true,
      }));
    });

    it('should have scheduler enabled by default', () => {
      expect(services.config.scheduler.enabled).toBe(true);
    });

    it('should use default cron schedule', () => {
      expect(services.config.scheduler.cron).toBe('0 2 * * *');
    });

    it('should start the cleanup job', () => {
      expect(services.scheduler.cleanupJob).not.toBeNull();
    });
  });

  describe('cron schedule validation', () => {
    it('should accept valid cron expression', async () => {
      ({ services, cleanup } = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: {
            enabled: true,
            cron: '*/30 * * * *', // Every 30 minutes
          },
        },
        skipListen: true,
      }));

      expect(services.scheduler.cleanupJob).not.toBeNull();
      expect(services.scheduler.cleanupJob?.nextRun()).toBeDefined();
    });

    it('should accept hourly cron expression', async () => {
      ({ services, cleanup } = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: {
            enabled: true,
            cron: '0 */6 * * *', // Every 6 hours
          },
        },
        skipListen: true,
      }));

      expect(services.scheduler.cleanupJob).not.toBeNull();
    });
  });

  describe('CLI mode', () => {
    beforeEach(async () => {
      ({ services, cleanup } = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: {
            enabled: true,
          },
        },
        cliMode: true,
        skipListen: true,
      }));
    });

    it('should still initialize scheduler in CLI mode', () => {
      // Scheduler is part of core services which are loaded in CLI mode
      expect(services.scheduler).toBeDefined();
    });
  });
});
