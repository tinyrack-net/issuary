import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  PerfReportContext,
  PerfReportShard,
} from '../src/test-utils/perf/reporter.js';
import {
  PERF_EVENTS_PATH_ENV,
  parsePerfResultEvents,
  writePerfReportIfEnabled,
} from '../src/test-utils/perf/reporter.js';

const VITEST_PATH = fileURLToPath(
  new URL('../node_modules/vitest/vitest.mjs', import.meta.url),
);

function parseShardValue(value: string): PerfReportShard {
  const parts = value.split('/');
  const index = Number(parts[0]);
  const total = Number(parts[1]);

  if (
    parts.length !== 2 ||
    !Number.isInteger(index) ||
    !Number.isInteger(total) ||
    index < 1 ||
    total < 1 ||
    index > total
  ) {
    throw new Error(`Invalid --shard value: ${value}`);
  }

  return { index, total };
}

function parseShard(args: readonly string[]): PerfReportShard | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg?.startsWith('--shard=')) {
      return parseShardValue(arg.slice('--shard='.length));
    }

    if (arg === '--shard') {
      const value = args[index + 1];

      if (!value) {
        throw new Error('Missing value for --shard');
      }

      return parseShardValue(value);
    }
  }

  return undefined;
}

async function runVitest(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  const child = spawn(
    process.execPath,
    [
      '--conditions=@tinyauth/source',
      VITEST_PATH,
      'run',
      '--config',
      'vitest.perf.config.ts',
      ...args,
    ],
    {
      env,
      stdio: 'inherit',
    },
  );

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      resolve(code ?? 1);
    });
  });
}

function createReportContext(args: readonly string[]): PerfReportContext {
  const context: PerfReportContext = {};
  const commitSha = process.env['GITHUB_SHA'];
  const ref = process.env['GITHUB_REF'];
  const runId = process.env['GITHUB_RUN_ID'];
  const runAttempt = process.env['GITHUB_RUN_ATTEMPT'];
  const shard = parseShard(args);

  if (commitSha) {
    context.commitSha = commitSha;
  }

  if (ref) {
    context.ref = ref;
  }

  if (runId) {
    context.runId = runId;
  }

  if (runAttempt) {
    context.runAttempt = runAttempt;
  }

  if (shard) {
    context.shard = shard;
  }

  return context;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const reportPath = process.env['TINYAUTH_PERF_REPORT_PATH'];
const eventsPath = reportPath
  ? `${reportPath}.${String(process.pid)}.events.jsonl`
  : undefined;
const childEnv: NodeJS.ProcessEnv = { ...process.env };
let testExitCode = 1;
let reportFailed = false;

if (eventsPath) {
  await mkdir(dirname(eventsPath), { recursive: true });
  await rm(eventsPath, { force: true });
  childEnv[PERF_EVENTS_PATH_ENV] = eventsPath;
} else {
  delete childEnv[PERF_EVENTS_PATH_ENV];
}

try {
  testExitCode = await runVitest(args, childEnv);
} catch (error) {
  console.error(`Failed to start performance tests: ${errorMessage(error)}`);
}

if (reportPath) {
  try {
    const eventContent =
      eventsPath && existsSync(eventsPath)
        ? await readFile(eventsPath, 'utf8')
        : '';
    const results = parsePerfResultEvents(eventContent);

    await mkdir(dirname(reportPath), { recursive: true });
    await writePerfReportIfEnabled({
      results,
      env: process.env,
      writeFile,
      context: createReportContext(args),
    });
  } catch (error) {
    reportFailed = true;
    console.error(`Failed to write performance report: ${errorMessage(error)}`);
  } finally {
    if (eventsPath) {
      await rm(eventsPath, { force: true });
    }
  }
}

process.exitCode = testExitCode === 0 && !reportFailed ? 0 : 1;
