import { z } from 'zod';

import type { HttpPerfResult, StatusCounts } from './metrics.js';

export const PERF_REPORT_SCHEMA_VERSION = 2;
export const PERF_EVENTS_PATH_ENV = 'TINYAUTH_PERF_EVENTS_PATH';

export type PerfReportShard = {
  index: number;
  total: number;
};

export type PerfReportContext = {
  commitSha?: string | undefined;
  ref?: string | undefined;
  runId?: string | undefined;
  runAttempt?: string | undefined;
  shard?: PerfReportShard | undefined;
};

export type PerfReport = {
  schemaVersion: typeof PERF_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  node: string;
  platform: string;
  arch: string;
  commitSha: string | null;
  ref: string | null;
  runId: string | null;
  runAttempt: string | null;
  shard: PerfReportShard | null;
  scenarios: HttpPerfResult[];
};

const statusCountsSchema = z
  .record(z.string(), z.number().int().nonnegative())
  .transform((statusCounts, context) => {
    const parsedStatusCounts: StatusCounts = {};

    for (const [status, count] of Object.entries(statusCounts)) {
      const statusCode = Number(status);

      if (
        !Number.isInteger(statusCode) ||
        statusCode < 100 ||
        statusCode > 599
      ) {
        context.addIssue({
          code: 'custom',
          message: `Invalid HTTP status code: ${status}`,
        });
        return z.NEVER;
      }

      parsedStatusCounts[statusCode] = count;
    }

    return parsedStatusCounts;
  });

const perfBudgetSchema = z
  .object({
    minRps: z.number().nonnegative().optional(),
    maxP95Ms: z.number().nonnegative().optional(),
  })
  .strict();

const perfWorkloadSchema = z
  .object({
    kind: z.enum(['standard', 'expensive']),
    warmupRequests: z.number().int().nonnegative(),
    requests: z.number().int().nonnegative(),
    concurrency: z.number().int().nonnegative(),
  })
  .strict();

const perfErrorSchema = z
  .object({
    phase: z.enum(['warmup', 'measure', 'budget']),
    index: z.number().int().nonnegative().nullable(),
    stage: z.enum(['request', 'status', 'validation', 'budget']),
    message: z.string().min(1).max(500),
  })
  .strict();

const httpPerfResultSchema: z.ZodType<HttpPerfResult> = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1),
    outcome: z.enum(['passed', 'failed']),
    workload: perfWorkloadSchema,
    budget: perfBudgetSchema,
    measurementMs: z.number().nonnegative(),
    totalRequests: z.number().int().nonnegative(),
    success: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    rps: z.number().nonnegative(),
    p50Ms: z.number().nonnegative(),
    p95Ms: z.number().nonnegative(),
    p99Ms: z.number().nonnegative(),
    maxMs: z.number().nonnegative(),
    errorRate: z.number().min(0).max(1),
    statusCounts: statusCountsSchema,
    errors: z.array(perfErrorSchema).max(5),
  })
  .strict();

const perfReportShardSchema = z
  .object({
    index: z.number().int().positive(),
    total: z.number().int().positive(),
  })
  .strict()
  .refine((shard) => shard.index <= shard.total, {
    message: 'Shard index must not exceed shard total',
  });

const perfReportSchema: z.ZodType<PerfReport> = z
  .object({
    schemaVersion: z.literal(PERF_REPORT_SCHEMA_VERSION),
    generatedAt: z.iso.datetime(),
    node: z.string().min(1),
    platform: z.string().min(1),
    arch: z.string().min(1),
    commitSha: z.string().min(1).nullable(),
    ref: z.string().min(1).nullable(),
    runId: z.string().min(1).nullable(),
    runAttempt: z.string().min(1).nullable(),
    shard: perfReportShardSchema.nullable(),
    scenarios: z.array(httpPerfResultSchema),
  })
  .strict();

export function createPerfReport(
  results: readonly HttpPerfResult[],
  context: PerfReportContext = {},
): PerfReport {
  return {
    schemaVersion: PERF_REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    commitSha: context.commitSha ?? null,
    ref: context.ref ?? null,
    runId: context.runId ?? null,
    runAttempt: context.runAttempt ?? null,
    shard: context.shard ? { ...context.shard } : null,
    scenarios: results.map((result) => ({
      ...result,
      workload: { ...result.workload },
      budget: { ...result.budget },
      statusCounts: { ...result.statusCounts },
      errors: result.errors.map((error) => ({ ...error })),
    })),
  };
}

export function parsePerfReport(content: string): PerfReport {
  return perfReportSchema.parse(JSON.parse(content));
}

export async function writePerfReportIfEnabled(input: {
  results: readonly HttpPerfResult[];
  env: NodeJS.ProcessEnv;
  writeFile: (path: string, content: string) => Promise<void>;
  context?: PerfReportContext;
}): Promise<string | undefined> {
  const path = input.env['TINYAUTH_PERF_REPORT_PATH'];

  if (!path) {
    return undefined;
  }

  const report = createPerfReport(input.results, input.context);
  await input.writeFile(path, `${JSON.stringify(report, null, 2)}\n`);

  return path;
}

export async function appendPerfResultEventIfEnabled(input: {
  result: HttpPerfResult;
  env: NodeJS.ProcessEnv;
  appendFile: (path: string, content: string) => Promise<void>;
}): Promise<string | undefined> {
  const path = input.env[PERF_EVENTS_PATH_ENV];

  if (!path) {
    return undefined;
  }

  await input.appendFile(path, `${JSON.stringify(input.result)}\n`);
  return path;
}

export function parsePerfResultEvents(content: string): HttpPerfResult[] {
  const results: HttpPerfResult[] = [];

  for (const line of content.split(/\r?\n/u)) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      continue;
    }

    results.push(httpPerfResultSchema.parse(JSON.parse(trimmedLine)));
  }

  return results;
}
