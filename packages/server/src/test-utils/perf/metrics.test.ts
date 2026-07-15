import { describe, expect, it } from 'vitest';

import { summarizeHttpPerf, summarizeLatencies } from './metrics.js';

function summarize(input: {
  totalRequests: number;
  success: number;
  failed: number;
  measurementMs: number;
}) {
  return summarizeHttpPerf({
    id: 'login',
    name: 'login',
    source: '<unit-test>',
    workload: {
      kind: 'standard',
      warmupRequests: 0,
      requests: input.totalRequests,
      concurrency: 2,
    },
    budget: {},
    totalRequests: input.totalRequests,
    success: input.success,
    failed: input.failed,
    measurementMs: input.measurementMs,
    latenciesMs: [100, 200, 300],
    statusCounts: { 200: input.success, 500: input.failed },
    errors: [],
  });
}

describe('summarizeLatencies', () => {
  it('computes p50/p95/p99/max from latency samples', () => {
    expect(summarizeLatencies([400, 100, 200, 300, 500])).toEqual({
      p50Ms: 300,
      p95Ms: 500,
      p99Ms: 500,
      maxMs: 500,
    });
  });
});

describe('summarizeHttpPerf', () => {
  it('computes RPS and error rate from the measured interval', () => {
    const result = summarize({
      totalRequests: 50,
      success: 48,
      failed: 2,
      measurementMs: 2_000,
    });

    expect(result.rps).toBe(25);
    expect(result.errorRate).toBe(0.04);
    expect(result.outcome).toBe('failed');
  });

  it('returns safe zero rates for empty or instantaneous measurements', () => {
    expect(
      summarize({
        totalRequests: 0,
        success: 0,
        failed: 0,
        measurementMs: 1_000,
      }),
    ).toMatchObject({ rps: 0, errorRate: 0, outcome: 'passed' });

    expect(
      summarize({
        totalRequests: 10,
        success: 10,
        failed: 0,
        measurementMs: 0,
      }).rps,
    ).toBe(0);
  });
});
