export type ValidationProfileName = 'local' | 'full';

export interface ValidationTask {
  name: string;
  weight: number;
  args: (workers: number) => string[];
}

export interface ValidationPlan {
  before: ValidationTask[];
  concurrent: ValidationTask[];
  concurrentTaskLimit?: number;
  after: ValidationTask[];
}

export type ValidationTaskExecutor = (
  task: ValidationTask,
  workers: number,
) => Promise<void>;

const DEFAULT_WORKER_BUDGET = 4;

const serverTask: ValidationTask = {
  name: 'server',
  weight: 5,
  args: (workers) => [
    '--filter',
    '@tinyrack/issuary-server',
    'test',
    '--run',
    `--maxWorkers=${workers}`,
  ],
};

const toolsTask: ValidationTask = {
  name: 'tools',
  weight: 1,
  args: (workers) => [
    '--filter',
    '@tinyrack/issuary-tools',
    'test',
    '--run',
    `--maxWorkers=${workers}`,
  ],
};

const homepageTask: ValidationTask = {
  name: 'homepage',
  weight: 1,
  args: (workers) => [
    '--filter',
    '@tinyrack/issuary-homepage',
    'test',
    `--maxWorkers=${workers}`,
  ],
};

function frontendUnitTask(script: 'test:unit' | 'test:unit:chromium') {
  return {
    name: 'frontend unit',
    weight: 4,
    args: (workers: number) => [
      '--filter',
      '@tinyrack/issuary-frontend',
      script,
      '--run',
      `--maxWorkers=${workers}`,
    ],
  } satisfies ValidationTask;
}

function standaloneTask(script: 'test' | 'test:prepared') {
  return {
    name: 'standalone',
    weight: 2,
    args: (workers: number) => [
      '--filter',
      '@tinyrack/issuary-standalone',
      script,
      '--run',
      `--maxWorkers=${workers}`,
    ],
  } satisfies ValidationTask;
}

export function parseWorkerBudget(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_WORKER_BUDGET;
  }

  const workerBudget = Number(value);
  if (!Number.isInteger(workerBudget) || workerBudget <= 0) {
    throw new Error('ISSUARY_TEST_WORKERS must be a positive integer');
  }

  return workerBudget;
}

export function parseValidationProfile(
  value: string | undefined,
): ValidationProfileName {
  if (value === undefined || value === 'local') {
    return 'local';
  }
  if (value === 'full') {
    return 'full';
  }
  throw new Error(`Unknown validation profile: ${value}`);
}

export function createValidationPlan(
  profile: ValidationProfileName,
): ValidationPlan {
  if (profile === 'local') {
    return {
      before: [],
      concurrent: [
        frontendUnitTask('test:unit:chromium'),
        serverTask,
        standaloneTask('test'),
        toolsTask,
      ],
      concurrentTaskLimit: 2,
      after: [
        {
          name: 'frontend assets',
          weight: 1,
          args: () => ['--filter', '@tinyrack/issuary-frontend', 'build:e2e'],
        },
        {
          name: 'frontend smoke',
          weight: 1,
          args: (workers) => [
            '--filter',
            '@tinyrack/issuary-frontend',
            'test:e2e:smoke:source',
            `--workers=${workers}`,
          ],
        },
        {
          name: 'homepage build',
          weight: 1,
          args: () => ['--filter', '@tinyrack/issuary-homepage', 'build'],
        },
        homepageTask,
      ],
    };
  }

  return {
    before: [{ name: 'build', weight: 1, args: () => ['build'] }],
    concurrent: [
      serverTask,
      frontendUnitTask('test:unit'),
      standaloneTask('test:prepared'),
      toolsTask,
      homepageTask,
      {
        name: 'example smoke',
        weight: 0,
        args: () => [
          '--filter',
          '@issuary-server-examples/node-hono-sqlite',
          'test:prepared',
        ],
      },
    ],
    after: [
      {
        name: 'standalone dist',
        weight: 1,
        args: (workers) => [
          '--filter',
          '@tinyrack/issuary-standalone',
          'test:dist:prepared',
          `--maxWorkers=${workers}`,
        ],
      },
      {
        name: 'frontend e2e',
        weight: 1,
        args: () => [
          '--filter',
          '@tinyrack/issuary-frontend',
          'test:e2e:sharded',
        ],
      },
    ],
  };
}

export function allocateWorkers(
  selectedTasks: ValidationTask[],
  workerBudget: number,
): number[] {
  if (selectedTasks.length > workerBudget) {
    throw new Error('Selected tasks exceed the global worker budget');
  }

  const allocations = selectedTasks.map(() => 1);
  let remaining = workerBudget - selectedTasks.length;
  const totalWeight = selectedTasks.reduce((sum, task) => sum + task.weight, 0);
  if (totalWeight === 0) {
    return allocations;
  }

  for (const [index, task] of selectedTasks.entries()) {
    const additional = Math.floor((remaining * task.weight) / totalWeight);
    allocations[index] = (allocations[index] ?? 1) + additional;
  }

  remaining =
    workerBudget - allocations.reduce((sum, allocation) => sum + allocation, 0);
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

async function runSequentialTasks(
  tasks: ValidationTask[],
  workerBudget: number,
  execute: ValidationTaskExecutor,
): Promise<void> {
  for (const task of tasks) {
    await execute(task, workerBudget);
  }
}

async function runConcurrentTasks(
  tasks: ValidationTask[],
  workerBudget: number,
  taskLimit: number,
  execute: ValidationTaskExecutor,
): Promise<void> {
  const batchSize = Math.min(workerBudget, taskLimit);
  for (let offset = 0; offset < tasks.length; offset += batchSize) {
    const selectedTasks = tasks.slice(offset, offset + batchSize);
    const allocations = allocateWorkers(selectedTasks, workerBudget);
    const results = await Promise.allSettled(
      selectedTasks.map((task, index) =>
        execute(task, allocations[index] ?? 1),
      ),
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

export async function runValidationPlan(
  plan: ValidationPlan,
  workerBudget: number,
  execute: ValidationTaskExecutor,
): Promise<void> {
  await runSequentialTasks(plan.before, workerBudget, execute);
  await runConcurrentTasks(
    plan.concurrent,
    workerBudget,
    plan.concurrentTaskLimit ?? workerBudget,
    execute,
  );
  await runSequentialTasks(plan.after, workerBudget, execute);
}
