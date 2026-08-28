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
  test.each([
    1, 4, 24,
  ])('uses detected parallelism %i as the default worker budget', (detectedParallelism) => {
    expect(parseWorkerBudget(undefined, detectedParallelism)).toBe(
      detectedParallelism,
    );
  });

  test('prefers a valid configured worker budget and rejects invalid values', () => {
    expect(parseWorkerBudget('2', 24)).toBe(2);
    expect(() => parseWorkerBudget('0')).toThrow(
      'ISSUARY_TEST_WORKERS must be a positive integer',
    );
    expect(() => parseWorkerBudget('-1')).toThrow(
      'ISSUARY_TEST_WORKERS must be a positive integer',
    );
    expect(() => parseWorkerBudget('1.5')).toThrow(
      'ISSUARY_TEST_WORKERS must be a positive integer',
    );
    expect(() => parseWorkerBudget('invalid')).toThrow(
      'ISSUARY_TEST_WORKERS must be a positive integer',
    );
  });

  test('parses supported validation profiles', () => {
    expect(parseValidationProfile(undefined)).toBe('quick');
    expect(parseValidationProfile('quick')).toBe('quick');
    expect(parseValidationProfile('full')).toBe('full');
    expect(() => parseValidationProfile('local')).toThrow(
      'Unknown validation profile: local',
    );
  });

  test('keeps concurrent allocations within the worker budget', () => {
    const tasks = createValidationPlan('quick').concurrent.slice(0, 4);
    const allocations = allocateWorkers(tasks, 4);
    expect(allocations.reduce((sum, workers) => sum + workers, 0)).toBe(4);
    expect(allocations.every((workers) => workers >= 1)).toBe(true);
  });

  test('allocates all available workers across the full concurrent group', () => {
    const tasks = createValidationPlan('full').concurrent;
    const allocations = allocateWorkers(tasks, 24);

    expect(allocations).toHaveLength(tasks.length);
    expect(allocations.reduce((sum, workers) => sum + workers, 0)).toBe(24);
    expect(allocations.every((workers) => workers >= 1)).toBe(true);
  });

  test('creates a focused quick plan', () => {
    const plan = createValidationPlan('quick');
    expect(plan.before.map((task) => task.name)).toEqual([
      'design system',
      'biome',
      'typecheck',
    ]);
    expect(plan.concurrent.map((task) => task.name)).toEqual([
      'frontend unit',
      'server',
      'standalone',
      'tools',
      'homepage',
    ]);
    expect(plan.after).toEqual([]);
    expect(plan.concurrentTaskLimit).toBe(2);
    expect(plan.concurrent[0]?.args(1)).toContain('test:unit:chromium');
    expect(plan.concurrent[4]?.args(1)).toContain('test:quick');
    expect(plan.before[0]?.args(1)).toEqual(['check:ui']);
  });

  test('preserves complete validation in the full plan', () => {
    const plan = createValidationPlan('full');
    expect(
      [...plan.before, ...plan.concurrent, ...plan.after].map(
        (task) => task.name,
      ),
    ).toEqual([
      'design system',
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
  });

  test('propagates concurrent failures and skips later batches', async () => {
    const executed: string[] = [];
    const execute: ValidationTaskExecutor = vi.fn(async (task) => {
      executed.push(task.name);
      if (task.name === 'server') throw new Error('server failed');
    });
    await expect(
      runValidationPlan(createValidationPlan('quick'), 4, execute),
    ).rejects.toThrow('Validation test group failed');
    expect(executed).not.toContain('standalone');
    expect(executed).not.toContain('homepage');
  });
});
