import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import {
  createValidationPlan,
  parseValidationProfile,
  parseWorkerBudget,
  runValidationPlan,
  type ValidationTask,
} from '#tools/lib/validation-runner.ts';

function readProfileArgument(args: string[]): string | undefined {
  const profileArgument = args.find((argument) =>
    argument.startsWith('--profile='),
  );
  return profileArgument?.slice('--profile='.length);
}

function formatDuration(durationMilliseconds: number): string {
  return `${(durationMilliseconds / 1000).toFixed(1)}s`;
}

function runPnpm(args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, {
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${label} failed (${signal ? `signal ${signal}` : `exit ${code}`})`,
        ),
      );
    });
  });
}

const profile = parseValidationProfile(
  readProfileArgument(process.argv.slice(2)),
);
const workerBudget = parseWorkerBudget(process.env['TINYAUTH_TEST_WORKERS']);
process.env['TINYAUTH_TEST_WORKERS'] = String(workerBudget);

process.stdout.write(
  `[validation] profile: ${profile}; global worker budget: ${workerBudget}\n`,
);

await runValidationPlan(
  createValidationPlan(profile),
  workerBudget,
  async (task: ValidationTask, workers: number) => {
    const startedAt = performance.now();
    process.stdout.write(
      `[validation] ${task.name}: started with ${workers} worker${workers === 1 ? '' : 's'}\n`,
    );
    try {
      await runPnpm(task.args(workers), task.name);
      process.stdout.write(
        `[validation] ${task.name}: completed in ${formatDuration(performance.now() - startedAt)}\n`,
      );
    } catch (error) {
      process.stderr.write(
        `[validation] ${task.name}: failed after ${formatDuration(performance.now() - startedAt)}\n`,
      );
      throw error;
    }
  },
);
