import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';

const jobSchema = z
  .object({
    if: z.string().optional(),
    name: z.string().optional(),
    needs: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough();
const workflowSchema = z.object({
  jobs: z.record(z.string(), jobSchema),
  on: z.record(z.string(), z.unknown()),
});

async function readWorkflow() {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../..',
  );
  const source = await readFile(
    path.join(repositoryRoot, '.github/workflows/ci.yml'),
    'utf8',
  );
  return { source, workflow: workflowSchema.parse(parse(source)) };
}

describe('CI workflow policy', () => {
  test('runs for pull requests and merge groups', async () => {
    const { workflow } = await readWorkflow();

    expect(workflow.on).toHaveProperty('pull_request');
    expect(workflow.on).toHaveProperty('merge_group');
  });

  test('keeps expensive and Windows validation out of pull requests', async () => {
    const { source, workflow } = await readWorkflow();
    const mergeOnlyJobs = [
      'full-e2e',
      'coverage',
      'performance',
      'windows-build',
      'windows-tests',
      'windows-frontend',
      'docker-build',
    ];

    for (const jobName of mergeOnlyJobs) {
      const condition = workflow.jobs[jobName]?.if;
      expect(condition, `${jobName} must have an event condition`).toContain(
        "github.event_name == 'merge_group'",
      );
      expect(condition).not.toContain("github.event_name == 'pull_request'");
      expect(condition).not.toContain("github.ref == 'refs/heads/main'");
    }

    expect(source).toContain('VITEST_BROWSER_SET:');
    expect(source).toContain(
      "github.event_name == 'pull_request' || github.ref == 'refs/heads/main'",
    );
    expect(source).toContain("&& 'chromium firefox' || 'chromium'");
  });

  test('makes the quality gate depend on every quality job', async () => {
    const { source, workflow } = await readWorkflow();
    const needs = workflow.jobs['quality-gate']?.needs;

    expect(needs).toEqual(
      expect.arrayContaining([
        'changes',
        'build',
        'linux-tests',
        'frontend-smoke',
        'homepage',
        'performance-smoke',
        'full-e2e',
        'coverage',
        'performance',
        'windows-build',
        'windows-tests',
        'windows-frontend',
        'docker-build',
      ]),
    );
    expect(source).toContain('and (.changes.result == "success")');
    expect(source).toContain('*.md|docs/*');
  });
});
