import { describe, expect, it } from 'vitest';

import { summarizeHttpPerf, summarizeLatencies } from './metrics.js';

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
  it('computes RPS as totalRequests / (totalMs / 1000)', () => {
    expect(
      summarizeHttpPerf({
        name: 'login',
        totalRequests: 50,
        success: 48,
        failed: 2,
        totalMs: 2_000,
        latenciesMs: [100],
        statusCounts: { 200: 48, 500: 2 },
      }).rps,
    ).toBe(25);
  });

  it('computes errorRate as failed / totalRequests', () => {
    expect(
      summarizeHttpPerf({
        name: 'login',
        totalRequests: 50,
        success: 48,
        failed: 2,
        totalMs: 2_000,
        latenciesMs: [100],
        statusCounts: { 200: 48, 500: 2 },
      }).errorRate,
    ).toBe(0.04);
  });

  it('returns 0 RPS/errorRate safely when total requests or total milliseconds are zero', () => {
    expect(
      summarizeHttpPerf({
        name: 'empty',
        totalRequests: 0,
        success: 0,
        failed: 0,
        totalMs: 1_000,
        latenciesMs: [],
        statusCounts: {},
      }),
    ).toMatchObject({ rps: 0, errorRate: 0 });

    expect(
      summarizeHttpPerf({
        name: 'instant',
        totalRequests: 10,
        success: 10,
        failed: 0,
        totalMs: 0,
        latenciesMs: [],
        statusCounts: {},
      }).rps,
    ).toBe(0);
  });

  it('preserves statusCounts values', () => {
    const statusCounts = { 200: 9, 401: 1 };

    expect(
      summarizeHttpPerf({
        name: 'login',
        totalRequests: 10,
        success: 9,
        failed: 1,
        totalMs: 1_000,
        latenciesMs: [100, 200, 300],
        statusCounts,
      }).statusCounts,
    ).toEqual(statusCounts);
  });
});
