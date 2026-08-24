import { describe, expect, test, vi } from 'vitest';
import {
  allocateWorkers,
  createValidationPlan,
  parseValidationProfile,
  parseWorkerBudget,
  runValidationPlan,
  type ValidationTaskExecutor,
} from './validation-runner.ts';

describe('validation runner', () => {
  test('uses a four-worker default and validates overrides', () => {
    expect(parseWorkerBudget(undefined)).toBe(4);
    expect(parseWorkerBudget('2')).toBe(2);
    expect(() => parseWorkerBudget('0')).toThrow(
      'ISSUARY_TEST_WORKERS must be a positive integer',
    );
    expect(() => parseWorkerBudget('1.5')).toThrow(
      'ISSUARY_TEST_WORKERS must be a positive integer',
    );
  });

  test('parses supported validation profiles', () => {
    expect(parseValidationProfile(undefined)).toBe('local');
    expect(parseValidationProfile('local')).toBe('local');
    expect(parseValidationProfile('full')).toBe('full');
    expect(() => parseValidationProfile('ci')).toThrow(
      'Unknown validation profile: ci',
    );
  });

  test('keeps concurrent worker allocations within the global budget', () => {
    const tasks = createValidationPlan('local').concurrent.slice(0, 4);
    const allocations = allocateWorkers(tasks, 4);

    expect(allocations).toHaveLength(4);
    expect(allocations.reduce((sum, workers) => sum + workers, 0)).toBe(4);
    expect(allocations.every((workers) => workers >= 1)).toBe(true);
  });

  test('creates a lightweight local plan', () => {
    const plan = createValidationPlan('local');
    const concurrentNames = plan.concurrent.map((task) => task.name);
    const afterNames = plan.after.map((task) => task.name);
    const frontendUnit = plan.concurrent.find(
      (task) => task.name === 'frontend unit',
    );
    const standalone = plan.concurrent.find(
      (task) => task.name === 'standalone',
    );
    const frontendSmoke = plan.after.find(
      (task) => task.name === 'frontend smoke',
    );

    expect(plan.before).toEqual([]);
    expect(plan.concurrentTaskLimit).toBe(2);
    expect(concurrentNames).toEqual([
      'frontend unit',
      'server',
      'standalone',
      'tools',
    ]);
    expect(afterNames).toEqual([
      'frontend assets',
      'frontend smoke',
      'homepage build',
      'homepage',
    ]);
    expect(frontendUnit?.args(1)).toContain('test:unit:chromium');
    expect(standalone?.args(1)).toContain('test');
    expect(standalone?.args(1)).not.toContain('test:prepared');
    expect(frontendSmoke?.args(1)).toContain('test:e2e:smoke:source');
  });

  test('preserves the complete validation scope in the full plan', () => {
    const plan = createValidationPlan('full');
    const allNames = [...plan.before, ...plan.concurrent, ...plan.after].map(
      (task) => task.name,
    );
    const frontendUnit = plan.concurrent.find(
      (task) => task.name === 'frontend unit',
    );
    const standalone = plan.concurrent.find(
      (task) => task.name === 'standalone',
    );

    expect(allNames).toEqual([
      'build',
      'server',
      'frontend unit',
      'standalone',
      'tools',
      'homepage',
      'example smoke',
      'standalone dist',
      'frontend e2e',
    ]);
    expect(frontendUnit?.args(1)).toContain('test:unit');
    expect(frontendUnit?.args(1)).not.toContain('test:unit:chromium');
    expect(standalone?.args(1)).toContain('test:prepared');
  });

  test('gives local heavyweight suites multiple workers without exceeding four', async () => {
    const allocations: Array<[string, number]> = [];

    await runValidationPlan(
      createValidationPlan('local'),
      4,
      async (task, workers) => {
        allocations.push([task.name, workers]);
      },
    );

    expect(allocations.slice(0, 4)).toEqual([
      ['frontend unit', 2],
      ['server', 2],
      ['standalone', 3],
      ['tools', 1],
    ]);
  });

  test('propagates concurrent failures and skips later phases', async () => {
    const executed: string[] = [];
    const execute: ValidationTaskExecutor = vi.fn(async (task) => {
      executed.push(task.name);
      if (task.name === 'server') {
        throw new Error('server failed');
      }
    });

    await expect(
      runValidationPlan(createValidationPlan('local'), 4, execute),
    ).rejects.toThrow('Validation test group failed');
    expect(executed).not.toContain('frontend assets');
    expect(executed).not.toContain('frontend smoke');
    expect(executed).not.toContain('homepage build');
  });
});
