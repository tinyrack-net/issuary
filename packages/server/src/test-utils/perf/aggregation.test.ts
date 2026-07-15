import { describe, expect, it } from 'vitest';
import { aggregatePerfReports, createPerfJobSummary } from './aggregation.js';
import type { HttpPerfResult } from './metrics.js';
import type { PerfReport } from './reporter.js';
import { createPerfReport } from './reporter.js';
import {
  PERF_SCENARIO_CATALOG,
  perfWorkloadMinimums,
} from './scenario-catalog.js';

function result(index: number): HttpPerfResult {
  const definition = PERF_SCENARIO_CATALOG[index];

  if (!definition) {
    throw new Error(`Missing catalog scenario ${String(index)}`);
  }

  const minimums = perfWorkloadMinimums(definition.workload);
  return {
    id: definition.id,
    name: definition.name,
    source: definition.source,
    outcome: 'passed',
    workload: {
      kind: definition.workload,
      warmupRequests: minimums.warmupRequests,
      requests: minimums.requests,
      concurrency: 2,
    },
    budget: { ...definition.budget },
    measurementMs: 1_000,
    totalRequests: minimums.requests,
    success: minimums.requests,
    failed: 0,
    rps: 100,
    p50Ms: 10,
    p95Ms: 20,
    p99Ms: 25,
    maxMs: 30,
    errorRate: 0,
    statusCounts: {
      [definition.expectedStatuses[0] ?? 200]: minimums.requests,
    },
    errors: [],
  };
}

function reports(): PerfReport[] {
  const shards: HttpPerfResult[][] = [[], [], [], []];

  for (let index = 0; index < PERF_SCENARIO_CATALOG.length; index += 1) {
    shards[index % 4]?.push(result(index));
  }

  return shards.map((scenarios, index) =>
    createPerfReport(scenarios, {
      commitSha: 'current',
      ref: 'refs/heads/main',
      shard: { index: index + 1, total: 4 },
    }),
  );
}

describe('aggregatePerfReports', () => {
  it('requires all 107 catalog scenarios exactly once across four shards', () => {
    const aggregation = aggregatePerfReports({
      reports: reports(),
      expectedShards: 4,
    });

    expect(aggregation.errors).toEqual([]);
    expect(aggregation.report.scenarios).toHaveLength(107);
    expect(
      new Set(aggregation.report.scenarios.map((item) => item.id)).size,
    ).toBe(107);
    expect(aggregation.report.shard).toBeNull();
  });

  it('reports missing shards, duplicate scenarios, and failed outcomes', () => {
    const current = reports();
    const first = current[0];

    if (!first?.scenarios[0]) {
      throw new Error('Missing test scenario');
    }

    first.scenarios.push({ ...first.scenarios[0], outcome: 'failed' });
    const aggregation = aggregatePerfReports({
      reports: current.slice(0, 3),
      expectedShards: 4,
    });

    expect(aggregation.errors).toEqual(
      expect.arrayContaining([
        'Expected 4 shard reports, received 3',
        'Missing shard report 4',
        expect.stringContaining('Duplicate performance scenario:'),
        expect.stringContaining('Performance scenario failed:'),
      ]),
    );
  });

  it('rejects unknown scenarios, inconsistent passed results, and mixed run metadata', () => {
    const current = reports();
    const firstScenario = current[0]?.scenarios[0];
    const secondScenario = current[0]?.scenarios[1];
    const secondReport = current[1];

    if (!firstScenario || !secondScenario || !secondReport) {
      throw new Error('Missing aggregation fixture');
    }

    firstScenario.id = 'unknown-scenario';
    secondScenario.success -= 1;
    secondReport.runId = 'different-run';

    const aggregation = aggregatePerfReports({
      reports: current,
      expectedShards: 4,
      loadErrors: ['Could not parse shard input'],
    });

    expect(aggregation.errors).toEqual(
      expect.arrayContaining([
        'Could not parse shard input',
        'Shard reports have inconsistent run metadata',
        'Unknown performance scenario id: unknown-scenario',
        expect.stringContaining('Inconsistent passed scenario result:'),
        expect.stringContaining('Missing performance scenario:'),
      ]),
    );
  });

  it('compares identical workloads without turning changes into failures', () => {
    const current = reports();
    const baseline = createPerfReport(
      current.flatMap((report) =>
        report.scenarios.map((scenario) => ({
          ...scenario,
          p95Ms: scenario.p95Ms / 2,
          rps: scenario.rps * 2,
        })),
      ),
      { commitSha: 'baseline' },
    );
    const aggregation = aggregatePerfReports({
      reports: current,
      expectedShards: 4,
      baseline,
    });

    expect(aggregation.errors).toEqual([]);
    expect(aggregation.trend?.compared).toHaveLength(107);
    expect(aggregation.trend?.compared[0]).toMatchObject({
      p95ChangePercent: 100,
      rpsDegradationPercent: 50,
    });
    expect(createPerfJobSummary({ aggregation })).toContain(
      'Largest regressions (observational)',
    );
  });

  it('excludes workload changes and zero baseline metrics', () => {
    const current = reports();
    const baselineScenarios = current.flatMap((report) =>
      report.scenarios.map((scenario, index) => {
        if (index === 0) {
          return {
            ...scenario,
            workload: {
              ...scenario.workload,
              requests: scenario.workload.requests + 1,
            },
          };
        }

        if (index === 1) {
          return { ...scenario, p95Ms: 0 };
        }

        return scenario;
      }),
    );
    const aggregation = aggregatePerfReports({
      reports: current,
      expectedShards: 4,
      baseline: createPerfReport(baselineScenarios),
    });

    expect(aggregation.trend?.excluded.map((item) => item.reason)).toEqual(
      expect.arrayContaining(['workload changed', 'zero baseline metric']),
    );
  });
});
