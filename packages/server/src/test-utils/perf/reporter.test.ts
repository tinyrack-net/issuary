import { describe, expect, it, vi } from 'vitest';

import type { HttpPerfResult } from './metrics.js';
import {
  appendPerfResultEventIfEnabled,
  createPerfReport,
  PERF_EVENTS_PATH_ENV,
  PERF_REPORT_SCHEMA_VERSION,
  parsePerfReport,
  parsePerfResultEvents,
  writePerfReportIfEnabled,
} from './reporter.js';

function result(overrides: Partial<HttpPerfResult> = {}): HttpPerfResult {
  return {
    id: 'get-api-health-smoke',
    name: 'GET /api/health smoke',
    source: 'src/routes/api/health/health.perf.test.ts',
    outcome: 'passed',
    workload: {
      kind: 'standard',
      warmupRequests: 10,
      requests: 50,
      concurrency: 5,
    },
    budget: { minRps: 5, maxP95Ms: 1_000 },
    measurementMs: 100,
    totalRequests: 50,
    success: 50,
    failed: 0,
    rps: 500,
    p50Ms: 1,
    p95Ms: 2,
    p99Ms: 3,
    maxMs: 4,
    errorRate: 0,
    statusCounts: { 200: 50 },
    errors: [],
    ...overrides,
  };
}

describe('performance report schema v2', () => {
  it('includes runtime, git, workflow, shard, workload, and budget metadata', () => {
    const report = createPerfReport([result()], {
      commitSha: 'abc123',
      ref: 'refs/heads/main',
      runId: '42',
      runAttempt: '2',
      shard: { index: 2, total: 4 },
    });

    expect(report).toMatchObject({
      schemaVersion: PERF_REPORT_SCHEMA_VERSION,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      commitSha: 'abc123',
      ref: 'refs/heads/main',
      runId: '42',
      runAttempt: '2',
      shard: { index: 2, total: 4 },
      scenarios: [
        {
          id: 'get-api-health-smoke',
          workload: { warmupRequests: 10, requests: 50, concurrency: 5 },
          budget: { minRps: 5, maxP95Ms: 1_000 },
        },
      ],
    });
    expect(Date.parse(report.generatedAt)).not.toBeNaN();
    expect(parsePerfReport(JSON.stringify(report))).toEqual(report);
  });

  it('writes nothing when reporting is disabled', async () => {
    const writeFile = vi.fn();

    await expect(
      writePerfReportIfEnabled({
        results: [result()],
        env: {},
        writeFile,
      }),
    ).resolves.toBeUndefined();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('writes the complete JSON document when enabled', async () => {
    const writeFile = vi.fn(async (_path: string, _content: string) => {});

    await expect(
      writePerfReportIfEnabled({
        results: [result()],
        env: { ISSUARY_PERF_REPORT_PATH: 'perf/report.json' },
        writeFile,
        context: { shard: { index: 1, total: 4 } },
      }),
    ).resolves.toBe('perf/report.json');

    const content = writeFile.mock.calls[0]?.[1];
    expect(content).toBeDefined();
    expect(parsePerfReport(content ?? '').shard).toEqual({
      index: 1,
      total: 4,
    });
  });

  it('appends and parses JSONL scenario events', async () => {
    const appendFile = vi.fn(async (_path: string, _content: string) => {});

    await appendPerfResultEventIfEnabled({
      result: result(),
      env: { [PERF_EVENTS_PATH_ENV]: 'perf/events.jsonl' },
      appendFile,
    });

    const content = appendFile.mock.calls[0]?.[1] ?? '';
    expect(parsePerfResultEvents(`${content}\n`)).toEqual([result()]);
  });

  it('rejects malformed report and event data', () => {
    const report = createPerfReport([result()]);
    expect(() =>
      parsePerfReport(JSON.stringify({ ...report, schemaVersion: 1 })),
    ).toThrow();
    expect(() =>
      parsePerfResultEvents(
        JSON.stringify(result({ statusCounts: { 99: 1 } })),
      ),
    ).toThrow();
  });

  it('propagates file write failures', async () => {
    await expect(
      writePerfReportIfEnabled({
        results: [result()],
        env: { ISSUARY_PERF_REPORT_PATH: 'perf/report.json' },
        writeFile: async () => {
          throw new Error('disk full');
        },
      }),
    ).rejects.toThrow('disk full');

    await expect(
      appendPerfResultEventIfEnabled({
        result: result(),
        env: { [PERF_EVENTS_PATH_ENV]: 'perf/events.jsonl' },
        appendFile: async () => {
          throw new Error('event disk full');
        },
      }),
    ).rejects.toThrow('event disk full');
  });
});
