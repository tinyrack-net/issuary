import { afterEach, describe, expect, test, vi } from 'vitest';
import { croner } from './croner.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('croner scheduler factory', () => {
  test('provides a scheduler handle with a future default run time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:05:00.000Z'));

    const scheduler = croner();
    const handle = await scheduler.start({
      scheduledJobs: [
        {
          id: 'cleanup.run-all',
          name: 'Run cleanup tasks',
          schedule: { type: 'cron', expression: scheduler.cleanupCron ?? '' },
          handler: async () => {},
        },
      ],
      backgroundJobs: [],
    });

    const nextRunAt = handle.getNextRunAt?.() ?? null;
    expect(nextRunAt).toBeInstanceOf(Date);
    expect(nextRunAt?.getTime()).toBeGreaterThan(Date.now());

    await handle.stop();
  });

  test('uses each scheduled job cron expression', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:05:00.000Z'));

    const handle = await croner().start({
      scheduledJobs: [
        {
          id: 'daily',
          name: 'Daily',
          schedule: { type: 'cron', expression: '0 2 * * *' },
          handler: async () => {},
        },
        {
          id: 'frequent',
          name: 'Frequent',
          schedule: { type: 'cron', expression: '*/30 * * * *' },
          handler: async () => {},
        },
      ],
      backgroundJobs: [],
    });

    const nextRunAt = handle.getNextRunAt?.() ?? null;

    expect(nextRunAt).toEqual(new Date('2026-03-12T00:30:00.000Z'));

    await handle.stop();
  });

  test('rejects background enqueue because croner is not durable', async () => {
    const handle = await croner().start({
      scheduledJobs: [],
      backgroundJobs: [],
    });

    await expect(
      handle.enqueue?.({ jobId: 'example', payload: null }),
    ).rejects.toThrow('Background jobs require a durable scheduler backend');

    await handle.stop();
  });
});
