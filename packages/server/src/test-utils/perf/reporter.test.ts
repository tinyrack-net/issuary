import { describe, expect, it } from 'vitest';

import type { HttpPerfResult } from './metrics.js';
import { createPerfReport, writePerfReportIfEnabled } from './reporter.js';

const scenario: HttpPerfResult = {
  name: 'token endpoint',
  totalRequests: 100,
  success: 98,
  failed: 2,
  rps: 50,
  p50Ms: 10,
  p95Ms: 25,
  p99Ms: 40,
  maxMs: 60,
  errorRate: 0.02,
  statusCounts: {
    200: 98,
    500: 2,
  },
};

describe('createPerfReport', () => {
  it('creates a report with scenario results', () => {
    const report = createPerfReport([scenario]);

    expect(report).toMatchObject({
      node: process.version,
      platform: process.platform,
      scenarios: [scenario],
    });
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt);
  });
});

describe('writePerfReportIfEnabled', () => {
  it('does not write when env var is missing', async () => {
    const writes: Array<{ path: string; content: string }> = [];

    const writtenPath = await writePerfReportIfEnabled({
      results: [scenario],
      env: {},
      writeFile: async (path, content) => {
        writes.push({ path, content });
      },
    });

    expect(writtenPath).toBeUndefined();
    expect(writes).toEqual([]);
  });

  it('does not write when env var is empty', async () => {
    const writes: Array<{ path: string; content: string }> = [];

    const writtenPath = await writePerfReportIfEnabled({
      results: [scenario],
      env: { TINYAUTH_PERF_REPORT_PATH: '' },
      writeFile: async (path, content) => {
        writes.push({ path, content });
      },
    });

    expect(writtenPath).toBeUndefined();
    expect(writes).toEqual([]);
  });

  it('writes pretty JSON when env var is present', async () => {
    const writes: Array<{ path: string; content: string }> = [];

    await writePerfReportIfEnabled({
      results: [scenario],
      env: { TINYAUTH_PERF_REPORT_PATH: 'perf-report.json' },
      writeFile: async (path, content) => {
        writes.push({ path, content });
      },
    });

    expect(writes).toHaveLength(1);
    expect(writes[0]).toStrictEqual({
      path: 'perf-report.json',
      content: `${JSON.stringify(JSON.parse(writes[0]?.content ?? '{}'), null, 2)}\n`,
    });
  });

  it('returns the written path', async () => {
    const writtenPath = await writePerfReportIfEnabled({
      results: [scenario],
      env: { TINYAUTH_PERF_REPORT_PATH: 'perf-report.json' },
      writeFile: async () => {},
    });

    expect(writtenPath).toBe('perf-report.json');
  });

  it('JSON parses back to the expected report shape', async () => {
    let writtenContent = '';

    await writePerfReportIfEnabled({
      results: [scenario],
      env: { TINYAUTH_PERF_REPORT_PATH: 'perf-report.json' },
      writeFile: async (_path, content) => {
        writtenContent = content;
      },
    });

    expect(JSON.parse(writtenContent)).toMatchObject({
      generatedAt: expect.any(String),
      node: process.version,
      platform: process.platform,
      scenarios: [scenario],
    });
  });
});
