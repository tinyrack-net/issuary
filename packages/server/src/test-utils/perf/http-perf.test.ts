import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { afterEach, describe, expect, it } from 'vitest';

import { deferPerfResponseValidation } from './deferred-validation.js';
import { PerfScenarioError, runHttpPerf } from './http-perf.js';
import { PERF_EVENTS_PATH_ENV, parsePerfResultEvents } from './reporter.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  delete process.env[PERF_EVENTS_PATH_ENV];
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('runHttpPerf', () => {
  it('runs concurrent warmup and measurement with deterministic contexts', async () => {
    const contexts: string[] = [];
    let activeWarmups = 0;
    let maxActiveWarmups = 0;

    const result = await runHttpPerf({
      catalog: 'disabled',
      name: 'context test',
      warmupRequests: 3,
      requests: 5,
      concurrency: 2,
      request: async (context) => {
        contexts.push(`${context.phase}:${String(context.index)}`);

        if (context.phase === 'warmup') {
          activeWarmups += 1;
          maxActiveWarmups = Math.max(maxActiveWarmups, activeWarmups);
          await new Promise((resolve) => setTimeout(resolve, 5));
          activeWarmups -= 1;
        }

        return new Response(null, { status: 200 });
      },
    });

    expect(contexts.filter((value) => value.startsWith('warmup:'))).toEqual(
      expect.arrayContaining(['warmup:0', 'warmup:1', 'warmup:2']),
    );
    expect(contexts.filter((value) => value.startsWith('measure:'))).toEqual(
      expect.arrayContaining([
        'measure:0',
        'measure:1',
        'measure:2',
        'measure:3',
        'measure:4',
      ]),
    );
    expect(maxActiveWarmups).toBe(2);
    expect(result.totalRequests).toBe(5);
    expect(result.workload).toMatchObject({
      warmupRequests: 3,
      requests: 5,
      concurrency: 2,
    });
  });

  it('runs response validation after the measured request interval', async () => {
    const measuredRequestIndexes: number[] = [];
    let validations = 0;
    const startedAt = performance.now();

    const result = await runHttpPerf({
      catalog: 'disabled',
      name: 'deferred validation',
      requests: 4,
      concurrency: 2,
      request: async (context) => {
        if (context.phase === 'measure') {
          measuredRequestIndexes.push(context.index);
        }

        const response = new Response(JSON.stringify({ ok: true }), {
          status: 200,
        });
        return deferPerfResponseValidation(response, async () => {
          if (context.phase === 'measure') {
            expect(measuredRequestIndexes).toHaveLength(4);
            validations += 1;
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
        });
      },
    });
    const elapsedMs = performance.now() - startedAt;

    expect(validations).toBe(4);
    expect(elapsedMs).toBeGreaterThanOrEqual(50);
    expect(result.measurementMs).toBeLessThan(elapsedMs - 30);
  });

  it('runs the explicit validate callback after all measured responses arrive', async () => {
    let measuredRequests = 0;
    let measuredValidations = 0;

    await runHttpPerf({
      catalog: 'disabled',
      name: 'explicit validation',
      warmupRequests: 2,
      requests: 3,
      concurrency: 2,
      request: async (context) => {
        if (context.phase === 'measure') {
          measuredRequests += 1;
        }

        return new Response(null, { status: 200 });
      },
      validate: (_response, context) => {
        if (context.phase === 'measure') {
          expect(measuredRequests).toBe(3);
          measuredValidations += 1;
        }
      },
    });

    expect(measuredValidations).toBe(3);
  });

  it('records a failing warmup before throwing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'issuary-perf-'));
    temporaryDirectories.push(directory);
    const eventsPath = join(directory, 'events.jsonl');
    process.env[PERF_EVENTS_PATH_ENV] = eventsPath;

    await expect(
      runHttpPerf({
        catalog: 'disabled',
        name: 'warmup failure',
        warmupRequests: 2,
        requests: 3,
        concurrency: 2,
        request: async (context) => {
          if (context.phase === 'warmup' && context.index === 0) {
            throw new Error('warmup failed');
          }

          return new Response(null, { status: 200 });
        },
      }),
    ).rejects.toBeInstanceOf(PerfScenarioError);

    const events = parsePerfResultEvents(await readFile(eventsPath, 'utf8'));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      outcome: 'failed',
      totalRequests: 0,
      errors: [
        {
          phase: 'warmup',
          index: 0,
          stage: 'request',
          message: 'warmup failed',
        },
      ],
    });
  });

  it('records request, status, and validation failures with at most five details', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'issuary-perf-'));
    temporaryDirectories.push(directory);
    const eventsPath = join(directory, 'events.jsonl');
    process.env[PERF_EVENTS_PATH_ENV] = eventsPath;

    await expect(
      runHttpPerf({
        catalog: 'disabled',
        name: 'measured failures',
        requests: 8,
        concurrency: 4,
        request: async (context) => {
          if (context.index === 0) {
            throw new Error('request failed');
          }

          const response = new Response(null, {
            status: context.index === 1 ? 500 : 200,
          });
          return deferPerfResponseValidation(response, () => {
            throw new Error(`invalid body ${String(context.index)}`);
          });
        },
      }),
    ).rejects.toBeInstanceOf(PerfScenarioError);

    const events = parsePerfResultEvents(await readFile(eventsPath, 'utf8'));
    const result = events[0];
    expect(result?.failed).toBe(8);
    expect(result?.errors).toHaveLength(5);
    expect(result?.errors.map((error) => error.stage)).toEqual(
      expect.arrayContaining(['request', 'status', 'validation']),
    );
  });

  it('records a budget violation before propagating the failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'issuary-perf-'));
    temporaryDirectories.push(directory);
    const eventsPath = join(directory, 'events.jsonl');
    process.env[PERF_EVENTS_PATH_ENV] = eventsPath;

    await expect(
      runHttpPerf({
        name: 'GET /.well-known/openid-configuration scaled clients',
        warmupRequests: 10,
        requests: 50,
        concurrency: 50,
        expectedStatuses: [200],
        request: async () => {
          await new Promise((resolve) => setTimeout(resolve, 600));
          return new Response(null, { status: 200 });
        },
      }),
    ).rejects.toBeInstanceOf(PerfScenarioError);

    const events = parsePerfResultEvents(await readFile(eventsPath, 'utf8'));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      outcome: 'failed',
      totalRequests: 50,
      errors: [
        {
          phase: 'budget',
          index: null,
          stage: 'budget',
        },
      ],
    });
  });

  it('counts configured expected statuses as successful responses', async () => {
    const result = await runHttpPerf({
      catalog: 'disabled',
      name: 'authorize redirect',
      requests: 4,
      concurrency: 2,
      expectedStatuses: [302],
      request: async () => new Response(null, { status: 302 }),
    });

    expect(result.success).toBe(4);
    expect(result.failed).toBe(0);
    expect(result.statusCounts).toEqual({ 302: 4 });
  });

  it('returns safe zeros for a disabled-catalog zero-request run', async () => {
    let calls = 0;

    const result = await runHttpPerf({
      catalog: 'disabled',
      name: 'empty',
      requests: 0,
      concurrency: 4,
      request: async () => {
        calls += 1;
        return new Response(null, { status: 200 });
      },
    });

    expect(calls).toBe(0);
    expect(result).toMatchObject({
      totalRequests: 0,
      success: 0,
      failed: 0,
      rps: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
      errorRate: 0,
      statusCounts: {},
    });
  });
});
