import { expect, test, vi } from 'vitest';
import { AsyncCleanupStack } from '#frontend/test-utils/async-cleanup-stack.ts';

test('disposes resources in reverse registration order', async () => {
  const calls: string[] = [];
  const cleanups = new AsyncCleanupStack();
  cleanups.defer(() => {
    calls.push('vite');
  });
  cleanups.defer(() => {
    calls.push('backend');
  });
  cleanups.defer(() => {
    calls.push('browser');
  });

  await cleanups.dispose();

  expect(calls).toEqual(['browser', 'backend', 'vite']);
});

test('continues cleanup after a disposer fails', async () => {
  const finalCleanup = vi.fn();
  const cleanups = new AsyncCleanupStack();
  cleanups.defer(finalCleanup);
  cleanups.defer(() => {
    throw new Error('prepare failure cleanup');
  });

  await expect(cleanups.dispose()).rejects.toThrow('Screen Lab cleanup failed');
  expect(finalCleanup).toHaveBeenCalledOnce();
});
