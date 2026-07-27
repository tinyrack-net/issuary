import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import path from 'node:path';

const cpuCount = availableParallelism();
const shardCount = Math.min(4, Math.max(1, Math.floor(cpuCount / 8)));
const testWorkerBudget = Math.max(1, cpuCount - shardCount);
const reportDirectory = path.resolve('blob-report');
const viteCacheRoot = path.resolve('node_modules/.cache/e2e-vite-shards');
const playwrightCacheRoot = path.resolve(
  'node_modules/.cache/e2e-playwright-shards',
);
const passthroughArgs = process.argv.slice(2);

function runPlaywright(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'node_modules/@playwright/test/cli.js', ...args],
      {
        env: environment,
        stdio: 'inherit',
      },
    );
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Playwright failed (${signal ? `signal ${signal}` : `exit ${code}`})`,
        ),
      );
    });
  });
}

await rm(reportDirectory, { recursive: true, force: true });
await rm(viteCacheRoot, { recursive: true, force: true });
await rm(playwrightCacheRoot, { recursive: true, force: true });
await mkdir(reportDirectory, { recursive: true });

const baseWorkers = Math.floor(testWorkerBudget / shardCount);
const extraWorkers = testWorkerBudget % shardCount;
const shardResults = await Promise.allSettled(
  Array.from({ length: shardCount }, (_, index) => {
    const shard = index + 1;
    const workers = baseWorkers + (index < extraWorkers ? 1 : 0);
    process.stdout.write(
      `[e2e] shard ${shard}/${shardCount}: ${workers} worker${workers === 1 ? '' : 's'}\n`,
    );
    return runPlaywright(
      [
        'test',
        `--shard=${shard}/${shardCount}`,
        `--workers=${workers}`,
        `--output=test-results/shard-${shard}`,
        '--reporter=blob',
        ...passthroughArgs,
      ],
      {
        ...process.env,
        E2E_VITE_CACHE_DIR: path.join(viteCacheRoot, `shard-${shard}`),
        PLAYWRIGHT_BLOB_OUTPUT_FILE: path.join(
          reportDirectory,
          `report-${shard}.zip`,
        ),
        PWTEST_CACHE_DIR: path.join(playwrightCacheRoot, `shard-${shard}`),
      },
    );
  }),
);

await runPlaywright(['merge-reports', '--reporter=html', reportDirectory], {
  ...process.env,
  PLAYWRIGHT_HTML_OPEN: 'never',
});

const failures = shardResults.filter((result) => result.status === 'rejected');
if (failures.length > 0) {
  throw new AggregateError(
    failures.map((failure) => String(failure.reason)),
    'One or more Playwright shards failed',
  );
}
