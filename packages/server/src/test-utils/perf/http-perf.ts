import { performance } from 'node:perf_hooks';

import type { HttpPerfResult, StatusCounts } from './metrics.js';
import { summarizeHttpPerf } from './metrics.js';

export type RunHttpPerfOptions = {
  name: string;
  warmupRequests?: number;
  requests: number;
  concurrency: number;
  request: () => Promise<Response>;
};

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

export async function runHttpPerf(
  options: RunHttpPerfOptions,
): Promise<HttpPerfResult> {
  const warmupRequests = normalizeRequestCount(options.warmupRequests ?? 0);
  const requests = normalizeRequestCount(options.requests);

  for (let index = 0; index < warmupRequests; index += 1) {
    await options.request();
  }

  if (requests <= 0) {
    return summarizeHttpPerf({
      name: options.name,
      totalRequests: 0,
      success: 0,
      failed: 0,
      totalMs: 0,
      latenciesMs: [],
      statusCounts: {},
    });
  }

  const concurrency = normalizeConcurrency(options.concurrency, requests);
  const latenciesMs: number[] = [];
  const statusCounts: StatusCounts = {};
  let success = 0;
  let failed = 0;
  let nextRequest = 0;
  const startedAt = performance.now();

  async function worker(): Promise<void> {
    while (nextRequest < requests) {
      nextRequest += 1;
      const requestStartedAt = performance.now();

      try {
        const response = await options.request();
        const latencyMs = performance.now() - requestStartedAt;
        latenciesMs.push(Number.isFinite(latencyMs) ? latencyMs : 0);
        countStatus(statusCounts, response.status);

        if (response.ok) {
          success += 1;
        } else {
          failed += 1;
        }
      } catch {
        const latencyMs = performance.now() - requestStartedAt;
        latenciesMs.push(Number.isFinite(latencyMs) ? latencyMs : 0);
        failed += 1;
      }
    }
  }

  const workers: Array<Promise<void>> = [];

  for (let index = 0; index < concurrency; index += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);

  const totalMs = performance.now() - startedAt;

  return summarizeHttpPerf({
    name: options.name,
    totalRequests: requests,
    success,
    failed,
    totalMs: Number.isFinite(totalMs) ? totalMs : 0,
    latenciesMs,
    statusCounts,
  });
}
