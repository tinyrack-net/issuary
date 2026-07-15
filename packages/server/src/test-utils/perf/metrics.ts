import { percentile } from './percentiles.js';
import type { PerfBudget, PerfWorkloadKind } from './scenario-catalog.js';

export type LatencySummary = {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
};

export type StatusCounts = Record<number, number>;

export type PerfPhase = 'warmup' | 'measure';

export type PerfRequestContext = {
  phase: PerfPhase;
  index: number;
};

export type PerfWorkload = {
  kind: PerfWorkloadKind;
  warmupRequests: number;
  requests: number;
  concurrency: number;
};

export type PerfErrorStage = 'request' | 'status' | 'validation' | 'budget';

export type PerfErrorSample = {
  phase: PerfPhase | 'budget';
  index: number | null;
  stage: PerfErrorStage;
  message: string;
};

export type HttpPerfResult = {
  id: string;
  name: string;
  source: string;
  outcome: 'passed' | 'failed';
  workload: PerfWorkload;
  budget: PerfBudget;
  measurementMs: number;
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
  errors: PerfErrorSample[];
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
  id: string;
  name: string;
  source: string;
  workload: PerfWorkload;
  budget: PerfBudget;
  totalRequests: number;
  success: number;
  failed: number;
  measurementMs: number;
  latenciesMs: readonly number[];
  statusCounts: StatusCounts;
  errors: readonly PerfErrorSample[];
}): HttpPerfResult {
  const latencySummary = summarizeLatencies(input.latenciesMs);
  const rps =
    input.measurementMs > 0
      ? safeRate(input.totalRequests, input.measurementMs / 1_000)
      : 0;
  const errorRate = safeRate(input.failed, input.totalRequests);

  return {
    id: input.id,
    name: input.name,
    source: input.source,
    outcome: input.failed === 0 ? 'passed' : 'failed',
    workload: { ...input.workload },
    budget: { ...input.budget },
    measurementMs: input.measurementMs,
    totalRequests: input.totalRequests,
    success: input.success,
    failed: input.failed,
    rps,
    errorRate,
    statusCounts: { ...input.statusCounts },
    errors: input.errors.map((error) => ({ ...error })),
    ...latencySummary,
  };
}
