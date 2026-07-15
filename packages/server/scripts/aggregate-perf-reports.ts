import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  aggregatePerfReports,
  createPerfJobSummary,
} from '../src/test-utils/perf/aggregation.js';
import type { PerfReport } from '../src/test-utils/perf/reporter.js';
import { parsePerfReport } from '../src/test-utils/perf/reporter.js';

type Arguments = {
  inputs: string[];
  output?: string;
  summary?: string;
  baseline?: string;
};

function parseArguments(args: readonly string[]): Arguments {
  const parsed: Arguments = { inputs: [] };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (!value) {
      continue;
    }

    if (
      value === '--output' ||
      value === '--summary' ||
      value === '--baseline'
    ) {
      const next = args[index + 1];

      if (!next) {
        throw new Error(`Missing value for ${value}`);
      }

      if (value === '--output') {
        parsed.output = next;
      } else if (value === '--summary') {
        parsed.summary = next;
      } else {
        parsed.baseline = next;
      }

      index += 1;
      continue;
    }

    parsed.inputs.push(value);
  }

  if (!parsed.output || !parsed.summary || parsed.inputs.length === 0) {
    throw new Error(
      'Usage: aggregate-perf-reports --output <json> --summary <markdown> [--baseline <json>] <shard-json...>',
    );
  }

  return parsed;
}

function message(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.slice(0, 500);
}

const args = parseArguments(process.argv.slice(2));
const outputPath = args.output;
const summaryPath = args.summary;

if (!outputPath || !summaryPath) {
  throw new Error('Output and summary paths are required');
}
const reports: PerfReport[] = [];
const loadErrors: string[] = [];

for (const path of args.inputs) {
  try {
    reports.push(parsePerfReport(await readFile(path, 'utf8')));
  } catch (error) {
    loadErrors.push(`Could not load ${path}: ${message(error)}`);
  }
}

let baseline: PerfReport | undefined;
let baselineNote: string | undefined;

if (args.baseline && existsSync(args.baseline)) {
  try {
    baseline = parsePerfReport(await readFile(args.baseline, 'utf8'));
  } catch {
    baselineNote =
      'Previous main report was incompatible with performance report schema v2.';
  }
} else {
  baselineNote = 'No previous main performance artifact was available.';
}

const aggregation = aggregatePerfReports({
  reports,
  expectedShards: 4,
  baseline,
  loadErrors,
});
const summary = createPerfJobSummary({ aggregation, baselineNote });

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(summaryPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(aggregation.report, null, 2)}\n`);
await writeFile(summaryPath, summary);

if (aggregation.errors.length > 0) {
  console.error(summary);
  process.exitCode = 1;
} else {
  console.log(summary);
}
