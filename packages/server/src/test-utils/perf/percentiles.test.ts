import { describe, expect, it } from 'vitest';

import { percentile } from './percentiles.js';

describe('percentile', () => {
  it('returns 0 for empty arrays', () => {
    expect(percentile([], 50)).toBe(0);
  });

  it('does not mutate input', () => {
    const values = [30, 10, 20];

    percentile(values, 50);

    expect(values).toEqual([30, 10, 20]);
  });

  it('calculates p50/p95/p99 from unsorted values', () => {
    const values = [400, 100, 200, 300, 500];

    expect(percentile(values, 50)).toBe(300);
    expect(percentile(values, 95)).toBe(500);
    expect(percentile(values, 99)).toBe(500);
  });

  it('clamps percentile below 0 to first value', () => {
    expect(percentile([30, 10, 20], -1)).toBe(10);
  });

  it('clamps percentile above 100 to last value', () => {
    expect(percentile([30, 10, 20], 101)).toBe(30);
  });
});
