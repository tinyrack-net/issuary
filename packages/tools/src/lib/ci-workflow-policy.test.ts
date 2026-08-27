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

function needsOf(workflow: z.infer<typeof workflowSchema>, jobName: string) {
  const needs = workflow.jobs[jobName]?.needs;
  return typeof needs === 'string' ? [needs] : needs;
}

describe('CI workflow policy', () => {
  test('runs PR and merge-group validation without a duplicate main push', async () => {
    const { source, workflow } = await readWorkflow();

    expect(workflow.on).toHaveProperty('pull_request');
    expect(workflow.on).toHaveProperty('merge_group');
    expect(workflow.on).toHaveProperty('schedule');
    expect(source).toContain("cron: '0 18 * * *'");
    expect(source).not.toContain('branches: [main]');
  });

  test('starts source tests without waiting for build artifacts', async () => {
    const { workflow } = await readWorkflow();

    for (const jobName of [
      'linux-server',
      'linux-tools',
      'linux-frontend-unit',
      'windows-server',
      'windows-tools',
      'windows-frontend-unit',
    ]) {
      expect(needsOf(workflow, jobName), jobName).toEqual(['changes']);
    }
  });

  test('shards server and browser tests at the intended level', async () => {
    const { source } = await readWorkflow();
    const expression = '$';

    expect(source).toContain(
      `name: Linux / Server (${expression}{{ matrix.shard }}/2)`,
    );
    expect(source).toContain(
      `name: Windows / Server (${expression}{{ matrix.shard }}/2)`,
    );
    expect(source).toContain(
      `name: Chromium E2E (${expression}{{ matrix.shard }}/6)`,
    );
    expect(source).toContain(
      `--project='*:chromium' --shard=${expression}{{ matrix.shard }}/6`,
    );
    expect(source).toContain("--project='minimal:firefox'");
    expect(source).toContain(
      `name: Firefox E2E (${expression}{{ matrix.shard }}/6)`,
    );
    expect(source).toContain(
      `--project='*:firefox' --shard=${expression}{{ matrix.shard }}/6`,
    );
  });

  test('keeps exhaustive coverage, performance, and Firefox E2E off merge groups', async () => {
    const { workflow } = await readWorkflow();

    for (const jobName of ['coverage', 'performance', 'firefox-e2e']) {
      const condition = workflow.jobs[jobName]?.if;
      expect(condition, `${jobName} must have an event condition`).toContain(
        "github.event_name == 'schedule'",
      );
      expect(condition).toContain("startsWith(github.ref, 'refs/tags/v')");
      expect(condition).not.toContain("github.event_name == 'merge_group'");
      expect(condition).not.toContain("github.event_name == 'pull_request'");
    }
  });

  test('uses Linux build artifacts for Windows browser suites', async () => {
    const { source, workflow } = await readWorkflow();

    for (const jobName of ['windows-smoke', 'windows-screen']) {
      expect(needsOf(workflow, jobName)).toEqual(['changes', 'build']);
    }
    expect(source).toContain('with: { name: dist-linux, path: packages }');
  });

  test('makes the quality gate depend on every quality job', async () => {
    const { source, workflow } = await readWorkflow();
    const qualityJobs = [
      'changes',
      'build',
      'linux-server',
      'linux-tools',
      'linux-frontend-unit',
      'linux-standalone',
      'linux-example-smoke',
      'frontend-smoke',
      'homepage',
      'performance-smoke',
      'chromium-e2e',
      'firefox-smoke',
      'firefox-e2e',
      'coverage',
      'performance',
      'windows-build',
      'windows-server',
      'windows-tools',
      'windows-frontend-unit',
      'windows-standalone',
      'windows-smoke',
      'windows-screen',
      'docker-build',
    ];

    expect(needsOf(workflow, 'quality-gate')).toEqual(
      expect.arrayContaining(qualityJobs),
    );
    expect(source).toContain('and (.changes.result == "success")');
    expect(source).toContain('MERGE_BASE_SHA:');
    expect(source).toContain('MERGE_HEAD_SHA:');
    expect(source).toContain('classify-ci-changes.sh');
  });

  test('evaluates tag publishing after skipped quality jobs', async () => {
    const { workflow } = await readWorkflow();

    for (const jobName of ['docker-push', 'npm-publish']) {
      const condition = workflow.jobs[jobName]?.if;
      expect(
        condition,
        `${jobName} must override skipped-need propagation`,
      ).toContain('always()');
      expect(condition).toContain("startsWith(github.ref, 'refs/tags/v')");
      expect(condition).toContain("needs.quality-gate.result == 'success'");
    }
  });
});
