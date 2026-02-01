import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '@/server.js';
import { MINIMAL_TEST_CONFIG } from '@/test-utils/setup.js';

describe('scheduler plugin', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.restoreAllMocks();
  });

  describe('when scheduler is disabled', () => {
    beforeEach(async () => {
      app = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: {
            enabled: false,
          },
        },
        skipListen: true,
      });
    });

    it('should not start the cleanup job', () => {
      expect(app.scheduler).toBeDefined();
      expect(app.scheduler.cleanupJob).toBeNull();
    });

    it('should have scheduler decorator available', () => {
      expect(app.hasDecorator('scheduler')).toBe(true);
    });
  });

  describe('when scheduler is enabled', () => {
    beforeEach(async () => {
      app = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: {
            enabled: true,
            cleanup_cron: '0 2 * * *', // Daily at 2 AM
          },
        },
        skipListen: true,
      });
    });

    it('should start the cleanup job', () => {
      expect(app.scheduler).toBeDefined();
      expect(app.scheduler.cleanupJob).not.toBeNull();
    });

    it('should have a scheduled next run time', () => {
      const nextRun = app.scheduler.cleanupJob?.nextRun();
      expect(nextRun).toBeDefined();
      expect(nextRun).toBeInstanceOf(Date);
    });

    it('should stop the job on server close', async () => {
      const job = app.scheduler.cleanupJob;
      expect(job?.isStopped()).toBe(false);

      await app.close();

      expect(job?.isStopped()).toBe(true);
    });
  });

  describe('with default config', () => {
    beforeEach(async () => {
      // Default config should have scheduler enabled
      app = await createServer({
        config: MINIMAL_TEST_CONFIG,
        skipListen: true,
      });
    });

    it('should have scheduler enabled by default', () => {
      expect(app.config.scheduler.enabled).toBe(true);
    });

    it('should use default cron schedule', () => {
      expect(app.config.scheduler.cleanup_cron).toBe('0 2 * * *');
    });

    it('should start the cleanup job', () => {
      expect(app.scheduler.cleanupJob).not.toBeNull();
    });
  });

  describe('cron schedule validation', () => {
    it('should accept valid cron expression', async () => {
      app = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: {
            enabled: true,
            cleanup_cron: '*/30 * * * *', // Every 30 minutes
          },
        },
        skipListen: true,
      });

      expect(app.scheduler.cleanupJob).not.toBeNull();
      expect(app.scheduler.cleanupJob?.nextRun()).toBeDefined();
    });

    it('should accept hourly cron expression', async () => {
      app = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: {
            enabled: true,
            cleanup_cron: '0 */6 * * *', // Every 6 hours
          },
        },
        skipListen: true,
      });

      expect(app.scheduler.cleanupJob).not.toBeNull();
    });
  });

  describe('CLI mode', () => {
    beforeEach(async () => {
      app = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          scheduler: {
            enabled: true,
          },
        },
        cliMode: true,
        skipListen: true,
      });
    });

    it('should still initialize scheduler in CLI mode', () => {
      // Scheduler is part of core plugins which are loaded in CLI mode
      expect(app.hasDecorator('scheduler')).toBe(true);
    });
  });
});
