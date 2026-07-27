import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';

interface ValidationTask {
  name: string;
  weight: number;
  args: (workers: number) => string[];
}

const tasks: ValidationTask[] = [
  {
    name: 'server',
    weight: 5,
    args: (workers) => [
      '--filter',
      '@tinyrack/tinyauth-server',
      'test',
      '--run',
      `--maxWorkers=${workers}`,
    ],
  },
  {
    name: 'frontend unit',
    weight: 4,
    args: (workers) => [
      '--filter',
      '@tinyrack/tinyauth-frontend',
      'test:unit',
      '--run',
      `--maxWorkers=${workers}`,
    ],
  },
  {
    name: 'standalone',
    weight: 2,
    args: (workers) => [
      '--filter',
      '@tinyrack/tinyauth-standalone',
      'test:prepared',
      '--run',
      `--maxWorkers=${workers}`,
    ],
  },
  {
    name: 'tools',
    weight: 1,
    args: (workers) => [
      '--filter',
      '@tinyrack/tinyauth-tools',
      'test',
      '--run',
      `--maxWorkers=${workers}`,
    ],
  },
  {
    name: 'homepage',
    weight: 1,
    args: (workers) => [
      '--filter',
      '@tinyrack/tinyauth-homepage',
      'test',
      `--maxWorkers=${workers}`,
    ],
  },
  {
    name: 'example smoke',
    // This smoke test is a single process rather than a worker-pooled suite.
    // Keep one slot for it and distribute the remaining CPU budget to suites
    // that can actually consume more workers.
    weight: 0,
    args: () => [
      '--filter',
      '@tinyauth-server-examples/node-hono-sqlite',
      'test:prepared',
    ],
  },
];

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

function allocateWorkers(
  selectedTasks: ValidationTask[],
  cpuCount: number,
): number[] {
  const allocations = selectedTasks.map(() => 1);
  let remaining = cpuCount - selectedTasks.length;
  const totalWeight = selectedTasks.reduce((sum, task) => sum + task.weight, 0);
  if (totalWeight === 0) {
    return allocations;
  }

  for (const [index, task] of selectedTasks.entries()) {
    const additional = Math.floor((remaining * task.weight) / totalWeight);
    allocations[index] = (allocations[index] ?? 1) + additional;
  }

  remaining =
    cpuCount - allocations.reduce((sum, allocation) => sum + allocation, 0);
  for (
    let index = 0;
    remaining > 0;
    index = (index + 1) % selectedTasks.length
  ) {
    const allocation = allocations[index];
    if (allocation !== undefined) {
      allocations[index] = allocation + 1;
      remaining -= 1;
    }
  }

  return allocations;
}

async function runCpuBudgetedTasks(cpuCount: number): Promise<void> {
  for (let offset = 0; offset < tasks.length; offset += cpuCount) {
    const selectedTasks = tasks.slice(offset, offset + cpuCount);
    const allocations = allocateWorkers(selectedTasks, cpuCount);
    const results = await Promise.allSettled(
      selectedTasks.map((task, index) => {
        const workers = allocations[index] ?? 1;
        process.stdout.write(
          `[validation] ${task.name}: ${workers} worker${workers === 1 ? '' : 's'}\n`,
        );
        return runPnpm(task.args(workers), task.name);
      }),
    );
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => String(failure.reason)),
        'Validation test group failed',
      );
    }
  }
}

const cpuCount = availableParallelism();
process.stdout.write(`[validation] global CPU budget: ${cpuCount}\n`);

await runPnpm(['build'], 'build');
await runCpuBudgetedTasks(cpuCount);
await runPnpm(
  [
    '--filter',
    '@tinyrack/tinyauth-standalone',
    'test:dist:prepared',
    `--maxWorkers=${cpuCount}`,
  ],
  'standalone dist',
);
await runPnpm(
  ['--filter', '@tinyrack/tinyauth-frontend', 'test:e2e:sharded'],
  'frontend e2e',
);
