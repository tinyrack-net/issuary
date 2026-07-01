import { percentile } from './percentiles.js';

export type LatencySummary = {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
};

export type StatusCounts = Record<number, number>;

export type HttpPerfResult = {
  name: string;
  totalRequests: number;
  success: number;
  failed: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  errorRate: number;
  statusCounts: StatusCounts;
};

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  const rate = numerator / denominator;

  return Number.isFinite(rate) ? rate : 0;
}

export function summarizeLatencies(values: readonly number[]): LatencySummary {
  const finiteValues = values.filter(Number.isFinite);
  let maxMs = finiteValues[0] ?? 0;

  for (const value of finiteValues) {
    if (value > maxMs) {
      maxMs = value;
    }
  }

  return {
    p50Ms: percentile(finiteValues, 50),
    p95Ms: percentile(finiteValues, 95),
    p99Ms: percentile(finiteValues, 99),
    maxMs,
  };
}

export function summarizeHttpPerf(input: {
  name: string;
  totalRequests: number;
  success: number;
  failed: number;
  totalMs: number;
  latenciesMs: readonly number[];
  statusCounts: StatusCounts;
}): HttpPerfResult {
  const latencySummary = summarizeLatencies(input.latenciesMs);
  const rps =
    input.totalMs > 0
      ? safeRate(input.totalRequests, input.totalMs / 1_000)
      : 0;
  const errorRate = safeRate(input.failed, input.totalRequests);

  return {
    name: input.name,
    totalRequests: input.totalRequests,
    success: input.success,
    failed: input.failed,
    rps,
    errorRate,
    statusCounts: { ...input.statusCounts },
    ...latencySummary,
  };
}
