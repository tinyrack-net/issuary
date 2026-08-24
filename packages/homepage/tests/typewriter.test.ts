import { afterEach, describe, expect, it, vi } from 'vitest';

import { startTypewriter } from '../app/components/hero-typewriter.tsx';

afterEach(() => vi.useRealTimers());

describe('Issuary typewriter', () => {
  it('renders the first phrase without scheduling motion when reduced', () => {
    vi.useFakeTimers();
    const values: string[] = [];
    const stop = startTypewriter({
      onChange: (value) => values.push(value),
      reducedMotion: true,
      words: ['ホームラボ', 'スタートアップ'],
    });

    expect(values).toEqual(['ホームラボ']);
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it('cycles phrases and disposes its pending timer', () => {
    vi.useFakeTimers();
    const values: string[] = [];
    const stop = startTypewriter({
      onChange: (value) => values.push(value),
      reducedMotion: false,
      words: ['Home', 'SaaS'],
    });

    vi.advanceTimersByTime(1_500);
    expect(values).toEqual(['Home', 'Hom']);
    expect(vi.getTimerCount()).toBe(1);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
