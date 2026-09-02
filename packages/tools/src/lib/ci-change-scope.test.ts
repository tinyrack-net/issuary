import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const classifierPath = path.join(
  repositoryRoot,
  'packages/tools/src/scripts/classify-ci-changes.sh',
);

async function classify(files: string[]) {
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn('bash', [classifierPath], {
      cwd: repositoryRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString('utf8'));
        return;
      }
      reject(new Error(Buffer.concat(stderr).toString('utf8')));
    });

    child.stdin.end(files.length === 0 ? '' : `${files.join('\n')}\n`);
  });

  return Object.fromEntries(
    output
      .trim()
      .split('\n')
      .map((line) => line.split('=')),
  );
}

describe('CI change scope classifier', () => {
  test('keeps documentation-only changes minimal', async () => {
    await expect(
      classify(['readme.md', 'docs/contributing.md']),
    ).resolves.toMatchObject({
      docs_only: 'true',
      full: 'false',
    });
  });

  test.each([
    ['frontend', 'packages/frontend/src/app.tsx'],
    ['server', 'packages/server/src/app.ts'],
  ])('selects the %s scope', async (scope, file) => {
    const result = await classify([file]);

    expect(result).toMatchObject({ docs_only: 'false', full: 'false' });
    expect(result[scope]).toBe('true');
  });

  test('combines known package scopes', async () => {
    await expect(
      classify([
        'packages/frontend/src/app.tsx',
        'packages/server/src/app.ts',
        'examples/servers/example.ts',
      ]),
    ).resolves.toMatchObject({
      examples: 'true',
      frontend: 'true',
      full: 'false',
      server: 'true',
    });
  });

  test.each([['pnpm-lock.yaml'], ['unknown/location.txt'], []])(
    'fails open for shared, unknown, or empty input: %j',
    async (...files) => {
      await expect(classify(files)).resolves.toEqual({
        docs_only: 'false',
        examples: 'true',
        frontend: 'true',
        full: 'true',
        homepage: 'true',
        server: 'true',
        standalone: 'true',
        tools: 'true',
      });
    },
  );
});
