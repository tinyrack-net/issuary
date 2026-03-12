import { afterEach, describe, expect, test, vi } from 'vitest';
import { croner } from '#backend/entrypoints/scheduler/croner.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('croner scheduler factory', () => {
  test('provides a scheduler handle with a future default run time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:05:00.000Z'));

    const scheduler = croner();
    const handle = await scheduler.start({
      runCleanup: async () => {},
    });

    const nextRunAt = handle.getNextRunAt?.() ?? null;
    expect(nextRunAt).toBeInstanceOf(Date);
    expect(nextRunAt?.getTime()).toBeGreaterThan(Date.now());

    await handle.stop();
  });

  test('supports overriding the cron schedule', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:05:00.000Z'));

    const defaultHandle = await croner().start({
      runCleanup: async () => {},
    });
    const customHandle = await croner({
      cron: '*/30 * * * *',
    }).start({
      runCleanup: async () => {},
    });

    const defaultNextRun = defaultHandle.getNextRunAt?.() ?? null;
    const customNextRun = customHandle.getNextRunAt?.() ?? null;

    expect(defaultNextRun).toBeInstanceOf(Date);
    expect(customNextRun).toBeInstanceOf(Date);
    expect(customNextRun?.getTime()).toBeLessThan(
      defaultNextRun?.getTime() ?? 0,
    );

    await defaultHandle.stop();
    await customHandle.stop();
  });
});
