import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { beforeEach, describe, expect, test } from 'vitest';
import { performRelease, type ReleaseLogger } from './release.ts';

const execFileAsync = promisify(execFile);

const TEST_LOGGER: ReleaseLogger = {
  info: () => {},
  start: () => {},
};

describe('performRelease', () => {
  let repoRoot = '';

  beforeEach(async () => {
    repoRoot = await mkdtemp(path.join(os.tmpdir(), 'tinyauth-tools-release-'));
    await setupRepository(repoRoot);
  });

  test('bumps package versions from the latest tag and creates commit and tag', async () => {
    const result = await performRelease({
      cwd: repoRoot,
      dryRun: false,
      logger: TEST_LOGGER,
      releaseType: 'minor',
      signTag: false,
    });

    expect(result).toEqual({
      dryRun: false,
      previousTag: 'v0.0.3',
      tag: 'v0.1.0',
      version: '0.1.0',
    });

    await expect(
      readVersion(repoRoot, 'packages/server/package.json'),
    ).resolves.toBe('0.1.0');
    await expect(
      readVersion(repoRoot, 'packages/frontend/package.json'),
    ).resolves.toBe('0.1.0');
    await expect(
      readVersion(repoRoot, 'packages/standalone/package.json'),
    ).resolves.toBe('0.1.0');

    await expect(git(repoRoot, ['tag', '--list', 'v0.1.0'])).resolves.toBe(
      'v0.1.0',
    );
    await expect(
      git(repoRoot, ['tag', '--list', '--format=%(contents)', 'v0.1.0']),
    ).resolves.toBe('release: v0.1.0');
    await expect(git(repoRoot, ['log', '-1', '--pretty=%s'])).resolves.toBe(
      'chore: release v0.1.0',
    );
  });

  test('fails when the worktree is dirty for a real release', async () => {
    await writeFile(path.join(repoRoot, 'README.md'), 'dirty\n', 'utf8');

    await expect(
      performRelease({
        cwd: repoRoot,
        dryRun: false,
        logger: TEST_LOGGER,
        releaseType: 'minor',
        signTag: false,
      }),
    ).rejects.toThrow('Git worktree must be clean before releasing');
  });

  test('dry run succeeds even when the worktree is dirty', async () => {
    await writeFile(path.join(repoRoot, 'README.md'), 'dirty\n', 'utf8');

    await expect(
      performRelease({
        cwd: repoRoot,
        dryRun: true,
        logger: TEST_LOGGER,
        releaseType: 'minor',
        signTag: false,
      }),
    ).resolves.toEqual({
      dryRun: true,
      previousTag: 'v0.0.3',
      tag: 'v0.1.0',
      version: '0.1.0',
    });
  });

  test('fails when target package versions do not match', async () => {
    await writePackageJson(repoRoot, 'packages/frontend/package.json', '2.0.0');
    await git(repoRoot, ['add', 'packages/frontend/package.json']);
    await git(repoRoot, ['commit', '-m', 'test: change frontend version']);

    await expect(
      performRelease({
        cwd: repoRoot,
        dryRun: false,
        logger: TEST_LOGGER,
        releaseType: 'minor',
        signTag: false,
      }),
    ).rejects.toThrow('Release targets must share the same version');

    await expect(
      readVersion(repoRoot, 'packages/server/package.json'),
    ).resolves.toBe('0.0.3');
    await expect(
      readVersion(repoRoot, 'packages/frontend/package.json'),
    ).resolves.toBe('2.0.0');
    await expect(git(repoRoot, ['tag', '--list', 'v0.1.0'])).resolves.toBe('');
    await expect(git(repoRoot, ['log', '-1', '--pretty=%s'])).resolves.toBe(
      'test: change frontend version',
    );
  });

  test('bumps from current package versions even when latest tag lags behind', async () => {
    await writePackageJson(repoRoot, 'packages/server/package.json', '0.0.4');
    await writePackageJson(repoRoot, 'packages/frontend/package.json', '0.0.4');
    await writePackageJson(
      repoRoot,
      'packages/standalone/package.json',
      '0.0.4',
    );
    await git(repoRoot, ['add', 'packages/server/package.json']);
    await git(repoRoot, ['add', 'packages/frontend/package.json']);
    await git(repoRoot, ['add', 'packages/standalone/package.json']);
    await git(repoRoot, ['commit', '-m', 'chore: release v0.0.4']);

    await expect(
      performRelease({
        cwd: repoRoot,
        dryRun: false,
        logger: TEST_LOGGER,
        releaseType: 'patch',
        signTag: false,
      }),
    ).resolves.toEqual({
      dryRun: false,
      previousTag: 'v0.0.4',
      tag: 'v0.0.5',
      version: '0.0.5',
    });

    await expect(git(repoRoot, ['tag', '--list', 'v0.0.5'])).resolves.toBe(
      'v0.0.5',
    );
    await expect(git(repoRoot, ['log', '-1', '--pretty=%s'])).resolves.toBe(
      'chore: release v0.0.5',
    );
  });

  test('dry run does not modify package versions or create git objects', async () => {
    const result = await performRelease({
      cwd: repoRoot,
      dryRun: true,
      logger: TEST_LOGGER,
      releaseType: 'minor',
      signTag: false,
    });

    expect(result).toEqual({
      dryRun: true,
      previousTag: 'v0.0.3',
      tag: 'v0.1.0',
      version: '0.1.0',
    });

    await expect(
      readVersion(repoRoot, 'packages/server/package.json'),
    ).resolves.toBe('0.0.3');
    await expect(git(repoRoot, ['tag', '--list', 'v0.1.0'])).resolves.toBe('');
    await expect(git(repoRoot, ['log', '-1', '--pretty=%s'])).resolves.toBe(
      'chore: seed release fixtures',
    );
  });

  test('does not require an existing release tag', async () => {
    const emptyRepo = await mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-tools-empty-'),
    );

    try {
      await git(emptyRepo, ['init']);
      await git(emptyRepo, ['config', 'user.name', 'TinyAuth Tests']);
      await git(emptyRepo, ['config', 'user.email', 'tests@example.com']);
      await git(emptyRepo, ['config', 'commit.gpgSign', 'false']);
      await git(emptyRepo, ['config', 'tag.gpgSign', 'false']);

      await writePackageJson(
        emptyRepo,
        'packages/server/package.json',
        '0.0.3',
      );
      await writePackageJson(
        emptyRepo,
        'packages/frontend/package.json',
        '0.0.3',
      );
      await writePackageJson(
        emptyRepo,
        'packages/standalone/package.json',
        '0.0.3',
      );
      await git(emptyRepo, ['add', 'packages/server/package.json']);
      await git(emptyRepo, ['add', 'packages/frontend/package.json']);
      await git(emptyRepo, ['add', 'packages/standalone/package.json']);
      await git(emptyRepo, ['commit', '-m', 'chore: seed release fixtures']);

      await expect(
        performRelease({
          cwd: emptyRepo,
          dryRun: false,
          logger: TEST_LOGGER,
          releaseType: 'minor',
          signTag: false,
        }),
      ).resolves.toEqual({
        dryRun: false,
        previousTag: 'v0.0.3',
        tag: 'v0.1.0',
        version: '0.1.0',
      });
    } finally {
      await rm(emptyRepo, { force: true, recursive: true });
    }
  });
});

async function setupRepository(repoRoot: string): Promise<void> {
  await git(repoRoot, ['init']);
  await git(repoRoot, ['config', 'user.name', 'TinyAuth Tests']);
  await git(repoRoot, ['config', 'user.email', 'tests@example.com']);
  await git(repoRoot, ['config', 'commit.gpgSign', 'false']);
  await git(repoRoot, ['config', 'tag.gpgSign', 'false']);

  await writePackageJson(repoRoot, 'packages/server/package.json', '0.0.3');
  await writePackageJson(repoRoot, 'packages/frontend/package.json', '0.0.3');
  await writePackageJson(repoRoot, 'packages/standalone/package.json', '0.0.3');

  await git(repoRoot, ['add', 'packages/server/package.json']);
  await git(repoRoot, ['add', 'packages/frontend/package.json']);
  await git(repoRoot, ['add', 'packages/standalone/package.json']);
  await git(repoRoot, ['commit', '-m', 'chore: seed release fixtures']);
  await git(repoRoot, ['tag', '-a', 'v0.0.3', '-m', 'v0.0.3']);
}

async function writePackageJson(
  repoRoot: string,
  relativePath: string,
  version: string,
): Promise<void> {
  const filePath = path.join(repoRoot, relativePath);
  const parentDirectory = path.dirname(filePath);

  await mkdir(parentDirectory, { recursive: true });

  await writeFile(
    filePath,
    `${JSON.stringify({ name: relativePath, version }, null, 2)}\n`,
    'utf8',
  );
}

async function readVersion(
  repoRoot: string,
  relativePath: string,
): Promise<string> {
  const filePath = path.join(repoRoot, relativePath);
  const content = await readFile(filePath, 'utf8');
  const packageJson = JSON.parse(content);

  if (typeof packageJson !== 'object' || packageJson === null) {
    throw new Error(`Invalid package json: ${relativePath}`);
  }

  const version = packageJson.version;

  if (typeof version !== 'string') {
    throw new Error(`Missing version: ${relativePath}`);
  }

  return version;
}

async function git(repoRoot: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return result.stdout.trim();
}
