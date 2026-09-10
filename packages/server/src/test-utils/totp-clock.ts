import { vi } from 'vitest';

export function advanceTotpClock(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + 30_000);
}
