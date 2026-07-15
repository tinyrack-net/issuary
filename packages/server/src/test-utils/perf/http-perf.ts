import { appendFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { runDeferredPerfResponseValidation } from './deferred-validation.js';
import type {
  HttpPerfResult,
  PerfErrorSample,
  PerfPhase,
  PerfRequestContext,
  StatusCounts,
} from './metrics.js';
import { summarizeHttpPerf } from './metrics.js';
import { appendPerfResultEventIfEnabled } from './reporter.js';
import type { PerfScenarioDefinition } from './scenario-catalog.js';
import {
  getPerfScenarioByName,
  perfWorkloadMinimums,
} from './scenario-catalog.js';

const MAX_ERROR_SAMPLES = 5;
const MAX_ERROR_MESSAGE_LENGTH = 500;

export type RunHttpPerfOptions = {
  name: string;
  warmupRequests?: number;
  requests: number;
  concurrency: number;
  expectedStatuses?: readonly number[];
  request: (context: PerfRequestContext) => Promise<Response>;
  validate?: (
    response: Response,
    context: PerfRequestContext,
  ) => Promise<void> | void;
  catalog?: 'required' | 'disabled';
};

type RequestSample = {
  context: PerfRequestContext;
  latencyMs: number;
  response?: Response;
  error?: unknown;
};

export class PerfScenarioError extends Error {
  constructor(result: HttpPerfResult) {
    const details = result.errors
      .map(
        (error) =>
          `${error.phase}${error.index === null ? '' : `[${String(error.index)}]`} ${error.stage}: ${error.message}`,
      )
      .join('; ');
    super(
      `Performance scenario failed: ${result.id}${details ? ` (${details})` : ''}`,
    );
    this.name = 'PerfScenarioError';
  }
}

export function perfRequestSequenceIndex(
  context: PerfRequestContext,
  warmupRequests: number,
): number {
  return context.phase === 'warmup'
    ? context.index
    : normalizeRequestCount(warmupRequests) + context.index;
}

export function perfFixture<T>(
  fixtures: readonly T[],
  context: PerfRequestContext,
  warmupRequests: number,
): T {
  const fixture = fixtures[perfRequestSequenceIndex(context, warmupRequests)];

  if (fixture === undefined) {
    throw new Error(
      `Missing performance fixture for ${context.phase}[${String(context.index)}]`,
    );
  }

  return fixture;
}

function normalizeRequestCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function normalizeConcurrency(value: number, requests: number): number {
  if (requests <= 0) {
    return 0;
  }

  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.min(Math.floor(value), requests);
}

function countStatus(statusCounts: StatusCounts, status: number): void {
  statusCounts[status] = (statusCounts[status] ?? 0) + 1;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function recordError(errors: PerfErrorSample[], error: PerfErrorSample): void {
  if (errors.length < MAX_ERROR_SAMPLES) {
    errors.push(error);
  }
}

function isSuccessStatus(
  response: Response,
  expectedStatuses: readonly number[],
): boolean {
  if (expectedStatuses.length === 0) {
    return response.ok;
  }

  return expectedStatuses.includes(response.status);
}

function normalizeStatuses(statuses: readonly number[]): number[] {
  return [...statuses].sort((left, right) => left - right);
}

function statusesEqual(
  left: readonly number[],
  right: readonly number[],
): boolean {
  const normalizedLeft = normalizeStatuses(left);
  const normalizedRight = normalizeStatuses(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((status, index) => status === normalizedRight[index])
  );
}

function testScenario(options: RunHttpPerfOptions): PerfScenarioDefinition {
  if (options.catalog !== 'disabled') {
    const scenario = getPerfScenarioByName(options.name);

    if (
      options.expectedStatuses &&
      !statusesEqual(options.expectedStatuses, scenario.expectedStatuses)
    ) {
      throw new Error(
        `Expected statuses for ${scenario.id} differ from the performance catalog`,
      );
    }

    return scenario;
  }

  return {
    id: `test-${options.name.replace(/[^a-z0-9]+/giu, '-').toLowerCase()}`,
    name: options.name,
    source: '<unit-test>',
    expectedStatuses: options.expectedStatuses ?? [],
    workload: 'standard',
    budget: {},
  };
}

async function runBatch(input: {
  phase: PerfPhase;
  requests: number;
  concurrency: number;
  request: RunHttpPerfOptions['request'];
}): Promise<RequestSample[]> {
  const samples: RequestSample[] = [];
  let nextRequest = 0;

  async function worker(): Promise<void> {
    while (nextRequest < input.requests) {
      const index = nextRequest;
      nextRequest += 1;
      const context: PerfRequestContext = { phase: input.phase, index };
      const requestStartedAt = performance.now();

      try {
        const response = await input.request(context);
        const latencyMs = performance.now() - requestStartedAt;
        samples[index] = {
          context,
          latencyMs: Number.isFinite(latencyMs) ? latencyMs : 0,
          response,
        };
      } catch (error) {
        const latencyMs = performance.now() - requestStartedAt;
        samples[index] = {
          context,
          latencyMs: Number.isFinite(latencyMs) ? latencyMs : 0,
          error,
        };
      }
    }
  }

  const workers: Array<Promise<void>> = [];

  for (let index = 0; index < input.concurrency; index += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return samples;
}

async function validateSample(
  sample: RequestSample,
  expectedStatuses: readonly number[],
  validate: RunHttpPerfOptions['validate'],
  errors: PerfErrorSample[],
): Promise<{ response?: Response; passed: boolean }> {
  if (sample.error) {
    recordError(errors, {
      phase: sample.context.phase,
      index: sample.context.index,
      stage: 'request',
      message: errorMessage(sample.error),
    });
    return { passed: false };
  }

  const response = sample.response;

  if (!response) {
    recordError(errors, {
      phase: sample.context.phase,
      index: sample.context.index,
      stage: 'request',
      message: 'Request completed without a response',
    });
    return { passed: false };
  }

  let passed = isSuccessStatus(response, expectedStatuses);

  if (!passed) {
    recordError(errors, {
      phase: sample.context.phase,
      index: sample.context.index,
      stage: 'status',
      message: `Unexpected HTTP status ${String(response.status)}`,
    });
  }

  try {
    await runDeferredPerfResponseValidation(response);

    if (validate) {
      await validate(response, sample.context);
    }
  } catch (error) {
    passed = false;
    recordError(errors, {
      phase: sample.context.phase,
      index: sample.context.index,
      stage: 'validation',
      message: errorMessage(error),
    });
  }

  return { response, passed };
}

function emptyResult(
  scenario: PerfScenarioDefinition,
  workload: HttpPerfResult['workload'],
  errors: PerfErrorSample[],
): HttpPerfResult {
  return summarizeHttpPerf({
    id: scenario.id,
    name: scenario.name,
    source: scenario.source,
    workload,
    budget: scenario.budget,
    totalRequests: 0,
    success: 0,
    failed: errors.length > 0 ? 1 : 0,
    measurementMs: 0,
    latenciesMs: [],
    statusCounts: {},
    errors,
  });
}

function applyBudget(
  result: HttpPerfResult,
  errors: PerfErrorSample[],
): HttpPerfResult {
  if (
    result.budget.minRps !== undefined &&
    result.rps <= result.budget.minRps
  ) {
    recordError(errors, {
      phase: 'budget',
      index: null,
      stage: 'budget',
      message: `RPS ${result.rps.toFixed(2)} must be greater than ${String(result.budget.minRps)}`,
    });
  }

  if (
    result.budget.maxP95Ms !== undefined &&
    result.p95Ms >= result.budget.maxP95Ms
  ) {
    recordError(errors, {
      phase: 'budget',
      index: null,
      stage: 'budget',
      message: `p95 ${result.p95Ms.toFixed(2)}ms must be less than ${String(result.budget.maxP95Ms)}ms`,
    });
  }

  if (errors.length === result.errors.length) {
    return result;
  }

  return {
    ...result,
    outcome: 'failed',
    errors: errors.map((error) => ({ ...error })),
  };
}

async function recordAndEnforce(
  result: HttpPerfResult,
): Promise<HttpPerfResult> {
  await appendPerfResultEventIfEnabled({
    result,
    env: process.env,
    appendFile,
  });

  if (result.outcome === 'failed') {
    throw new PerfScenarioError(result);
  }

  return result;
}

export async function runHttpPerf(
  options: RunHttpPerfOptions,
): Promise<HttpPerfResult> {
  const scenario = testScenario(options);
  const minimums =
    options.catalog === 'disabled'
      ? { warmupRequests: 0, requests: 0 }
      : perfWorkloadMinimums(scenario.workload);
  const warmupRequests = Math.max(
    normalizeRequestCount(options.warmupRequests ?? 0),
    minimums.warmupRequests,
  );
  const requests = Math.max(
    normalizeRequestCount(options.requests),
    minimums.requests,
  );
  const concurrency = normalizeConcurrency(options.concurrency, requests);
  const warmupConcurrency = normalizeConcurrency(
    options.concurrency,
    warmupRequests,
  );
  const workload: HttpPerfResult['workload'] = {
    kind: scenario.workload,
    warmupRequests,
    requests,
    concurrency,
  };
  const warmupErrors: PerfErrorSample[] = [];
  const warmupSamples = await runBatch({
    phase: 'warmup',
    requests: warmupRequests,
    concurrency: warmupConcurrency,
    request: options.request,
  });

  await Promise.all(
    warmupSamples.map((sample) =>
      validateSample(
        sample,
        scenario.expectedStatuses,
        options.validate,
        warmupErrors,
      ),
    ),
  );

  if (warmupErrors.length > 0) {
    return recordAndEnforce(emptyResult(scenario, workload, warmupErrors));
  }

  const measurementStartedAt = performance.now();
  const samples = await runBatch({
    phase: 'measure',
    requests,
    concurrency,
    request: options.request,
  });
  const measurementMs = performance.now() - measurementStartedAt;
  const errors: PerfErrorSample[] = [];
  const statusCounts: StatusCounts = {};
  let success = 0;
  let failed = 0;

  const validations = await Promise.all(
    samples.map((sample) =>
      validateSample(
        sample,
        scenario.expectedStatuses,
        options.validate,
        errors,
      ),
    ),
  );

  for (const validation of validations) {
    if (validation.response) {
      countStatus(statusCounts, validation.response.status);
    }

    if (validation.passed) {
      success += 1;
    } else {
      failed += 1;
    }
  }

  const result = summarizeHttpPerf({
    id: scenario.id,
    name: scenario.name,
    source: scenario.source,
    workload,
    budget: scenario.budget,
    totalRequests: requests,
    success,
    failed,
    measurementMs: Number.isFinite(measurementMs) ? measurementMs : 0,
    latenciesMs: samples.map((sample) => sample.latencyMs),
    statusCounts,
    errors,
  });

  return recordAndEnforce(applyBudget(result, errors));
}
