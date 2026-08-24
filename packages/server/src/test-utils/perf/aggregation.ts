import type { HttpPerfResult } from './metrics.js';
import type { PerfReport } from './reporter.js';
import { createPerfReport } from './reporter.js';
import type { PerfScenarioDefinition } from './scenario-catalog.js';
import {
  getPerfScenarioById,
  PERF_SCENARIO_CATALOG,
  perfWorkloadMinimums,
} from './scenario-catalog.js';

export type PerfTrendChange = {
  id: string;
  name: string;
  p95ChangePercent: number;
  rpsDegradationPercent: number;
  regressionScore: number;
  improvementScore: number;
};

export type PerfTrendExclusion = {
  id: string;
  reason: string;
};

export type PerfTrendComparison = {
  baselineCommitSha: string | null;
  compared: PerfTrendChange[];
  excluded: PerfTrendExclusion[];
};

export type PerfAggregation = {
  report: PerfReport;
  errors: string[];
  trend: PerfTrendComparison | null;
};

function sameBudget(
  left: HttpPerfResult['budget'],
  right: HttpPerfResult['budget'],
): boolean {
  return left.minRps === right.minRps && left.maxP95Ms === right.maxP95Ms;
}

function sameWorkload(
  left: HttpPerfResult['workload'],
  right: HttpPerfResult['workload'],
): boolean {
  return (
    left.kind === right.kind &&
    left.warmupRequests === right.warmupRequests &&
    left.requests === right.requests &&
    left.concurrency === right.concurrency
  );
}

function percentChange(current: number, baseline: number): number | undefined {
  if (baseline === 0) {
    return undefined;
  }

  return ((current - baseline) / baseline) * 100;
}

function compareTrend(
  current: readonly HttpPerfResult[],
  baseline: PerfReport,
): PerfTrendComparison {
  const baselineById = new Map(
    baseline.scenarios.map((scenario) => [scenario.id, scenario]),
  );
  const compared: PerfTrendChange[] = [];
  const excluded: PerfTrendExclusion[] = [];

  for (const scenario of current) {
    const previous = baselineById.get(scenario.id);

    if (!previous) {
      excluded.push({ id: scenario.id, reason: 'missing from baseline' });
      continue;
    }

    if (!sameWorkload(scenario.workload, previous.workload)) {
      excluded.push({ id: scenario.id, reason: 'workload changed' });
      continue;
    }

    const p95Change = percentChange(scenario.p95Ms, previous.p95Ms);
    const rpsChange = percentChange(scenario.rps, previous.rps);

    if (p95Change === undefined || rpsChange === undefined) {
      excluded.push({ id: scenario.id, reason: 'zero baseline metric' });
      continue;
    }

    const rpsDegradation = -rpsChange;
    compared.push({
      id: scenario.id,
      name: scenario.name,
      p95ChangePercent: p95Change,
      rpsDegradationPercent: rpsDegradation,
      regressionScore: Math.max(p95Change, rpsDegradation),
      improvementScore: Math.max(-p95Change, -rpsDegradation),
    });
  }

  return {
    baselineCommitSha: baseline.commitSha,
    compared,
    excluded,
  };
}

function validateReportShards(
  reports: readonly PerfReport[],
  expectedShards: number,
  errors: string[],
): void {
  const shardIndexes = new Set<number>();
  const firstReport = reports[0];

  if (reports.length !== expectedShards) {
    errors.push(
      `Expected ${String(expectedShards)} shard reports, received ${String(reports.length)}`,
    );
  }

  for (const report of reports) {
    if (
      firstReport &&
      (report.node !== firstReport.node ||
        report.platform !== firstReport.platform ||
        report.arch !== firstReport.arch ||
        report.commitSha !== firstReport.commitSha ||
        report.ref !== firstReport.ref ||
        report.runId !== firstReport.runId ||
        report.runAttempt !== firstReport.runAttempt)
    ) {
      errors.push('Shard reports have inconsistent run metadata');
    }

    if (!report.shard) {
      errors.push('Current performance report is missing shard metadata');
      continue;
    }

    if (report.shard.total !== expectedShards) {
      errors.push(
        `Shard ${String(report.shard.index)} declares total ${String(report.shard.total)}`,
      );
    }

    if (shardIndexes.has(report.shard.index)) {
      errors.push(`Duplicate shard report ${String(report.shard.index)}`);
    }

    shardIndexes.add(report.shard.index);
  }

  for (let index = 1; index <= expectedShards; index += 1) {
    if (!shardIndexes.has(index)) {
      errors.push(`Missing shard report ${String(index)}`);
    }
  }
}

function validateScenarios(
  scenarios: readonly HttpPerfResult[],
  errors: string[],
): void {
  const counts = new Map<string, number>();

  for (const result of scenarios) {
    counts.set(result.id, (counts.get(result.id) ?? 0) + 1);

    let definition: PerfScenarioDefinition;

    try {
      definition = getPerfScenarioById(result.id);
    } catch {
      errors.push(`Unknown performance scenario id: ${result.id}`);
      continue;
    }

    if (
      result.name !== definition.name ||
      result.source !== definition.source
    ) {
      errors.push(`Catalog metadata mismatch for ${result.id}`);
    }

    if (
      result.workload.kind !== definition.workload ||
      !sameBudget(result.budget, definition.budget)
    ) {
      errors.push(`Catalog workload or budget mismatch for ${result.id}`);
    }

    const minimums = perfWorkloadMinimums(definition.workload);

    if (
      result.workload.warmupRequests < minimums.warmupRequests ||
      result.workload.requests < minimums.requests
    ) {
      errors.push(`Workload sample count is too small for ${result.id}`);
    }

    if (result.outcome !== 'passed') {
      errors.push(`Performance scenario failed: ${result.id}`);
      continue;
    }

    const statusCount = Object.values(result.statusCounts).reduce(
      (total, count) => total + count,
      0,
    );
    const hasUnexpectedStatus = Object.keys(result.statusCounts).some(
      (status) => !definition.expectedStatuses.includes(Number(status)),
    );

    if (
      result.totalRequests !== result.workload.requests ||
      result.success !== result.totalRequests ||
      result.failed !== 0 ||
      result.errorRate !== 0 ||
      result.errors.length !== 0 ||
      statusCount !== result.totalRequests ||
      hasUnexpectedStatus
    ) {
      errors.push(`Inconsistent passed scenario result: ${result.id}`);
    }
  }

  for (const definition of PERF_SCENARIO_CATALOG) {
    const count = counts.get(definition.id) ?? 0;

    if (count === 0) {
      errors.push(`Missing performance scenario: ${definition.id}`);
    } else if (count > 1) {
      errors.push(
        `Duplicate performance scenario: ${definition.id} (${String(count)})`,
      );
    }
  }
}

export function aggregatePerfReports(input: {
  reports: readonly PerfReport[];
  expectedShards: number;
  baseline?: PerfReport | undefined;
  loadErrors?: readonly string[] | undefined;
}): PerfAggregation {
  const errors = [...(input.loadErrors ?? [])];
  validateReportShards(input.reports, input.expectedShards, errors);
  const scenarios = input.reports.flatMap((report) => report.scenarios);
  validateScenarios(scenarios, errors);
  const firstReport = input.reports[0];
  const report = createPerfReport(scenarios, {
    commitSha: firstReport?.commitSha ?? undefined,
    ref: firstReport?.ref ?? undefined,
    runId: firstReport?.runId ?? undefined,
    runAttempt: firstReport?.runAttempt ?? undefined,
  });

  return {
    report,
    errors,
    trend: input.baseline ? compareTrend(scenarios, input.baseline) : null,
  };
}

function percent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function trendTable(
  title: string,
  changes: readonly PerfTrendChange[],
): string[] {
  if (changes.length === 0) {
    return [`### ${title}`, '', 'No comparable changes.', ''];
  }

  return [
    `### ${title}`,
    '',
    '| Scenario | p95 change | RPS degradation |',
    '| --- | ---: | ---: |',
    ...changes.map(
      (change) =>
        `| ${change.name} | ${percent(change.p95ChangePercent)} | ${percent(change.rpsDegradationPercent)} |`,
    ),
    '',
  ];
}

export function createPerfJobSummary(input: {
  aggregation: PerfAggregation;
  baselineNote?: string | undefined;
}): string {
  const lines = [
    '# Issuary performance smoke',
    '',
    `- Scenarios: ${String(input.aggregation.report.scenarios.length)}/${String(PERF_SCENARIO_CATALOG.length)}`,
    `- Current commit: ${input.aggregation.report.commitSha ?? 'unknown'}`,
    `- Result: ${input.aggregation.errors.length === 0 ? 'passed' : 'failed'}`,
    '',
  ];

  if (input.aggregation.errors.length > 0) {
    lines.push('### Aggregation errors', '');
    lines.push(...input.aggregation.errors.map((error) => `- ${error}`), '');
  }

  if (!input.aggregation.trend) {
    lines.push(
      '### Main trend',
      '',
      input.baselineNote ?? 'No compatible previous main report was available.',
      '',
    );
    return `${lines.join('\n')}\n`;
  }

  const regressions = [...input.aggregation.trend.compared]
    .filter((change) => change.regressionScore > 0)
    .sort((left, right) => right.regressionScore - left.regressionScore)
    .slice(0, 10);
  const improvements = [...input.aggregation.trend.compared]
    .filter((change) => change.improvementScore > 0)
    .sort((left, right) => right.improvementScore - left.improvementScore)
    .slice(0, 10);

  lines.push(
    `- Baseline commit: ${input.aggregation.trend.baselineCommitSha ?? 'unknown'}`,
    `- Comparable scenarios: ${String(input.aggregation.trend.compared.length)}`,
    `- Excluded scenarios: ${String(input.aggregation.trend.excluded.length)}`,
    '',
    ...trendTable('Largest regressions (observational)', regressions),
    ...trendTable('Largest improvements (observational)', improvements),
  );

  if (input.aggregation.trend.excluded.length > 0) {
    lines.push('### Excluded comparisons', '');
    lines.push(
      ...input.aggregation.trend.excluded.map(
        (exclusion) => `- ${exclusion.id}: ${exclusion.reason}`,
      ),
      '',
    );
  }

  return `${lines.join('\n')}\n`;
}
