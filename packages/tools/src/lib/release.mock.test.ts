import { beforeEach, describe, expect, test, vi } from 'vitest';

const getRepoRoot = vi.fn();
const getWorktreeStatus = vi.fn();
const hasTag = vi.fn();
const stageFiles = vi.fn();
const createCommit = vi.fn();
const createTag = vi.fn();
const readPackageVersion = vi.fn();
const writePackageVersion = vi.fn();

vi.mock('./git.ts', () => ({
  createTag,
  createCommit,
  getRepoRoot,
  getWorktreeStatus,
  hasTag,
  stageFiles,
}));

vi.mock('./package-json.ts', () => ({
  readPackageVersion,
  writePackageVersion,
}));

describe('performRelease mocked safety checks', () => {
  beforeEach(() => {
    getRepoRoot.mockReset();
    getWorktreeStatus.mockReset();
    hasTag.mockReset();
    stageFiles.mockReset();
    createCommit.mockReset();
    createTag.mockReset();
    readPackageVersion.mockReset();
    writePackageVersion.mockReset();

    getRepoRoot.mockResolvedValue('/repo');
    getWorktreeStatus.mockResolvedValue('');
    hasTag.mockResolvedValue(false);
    readPackageVersion.mockResolvedValue('0.0.3');
  });

  test('fails when the computed next tag already exists', async () => {
    const { performRelease } = await import('./release.ts');

    hasTag.mockResolvedValue(true);

    await expect(
      performRelease({
        cwd: '/repo',
        dryRun: false,
        logger: {
          info: () => {},
          start: () => {},
        },
        releaseType: 'minor',
      }),
    ).rejects.toThrow('Release tag already exists: v0.1.0');

    expect(writePackageVersion).not.toHaveBeenCalled();
    expect(stageFiles).not.toHaveBeenCalled();
    expect(createCommit).not.toHaveBeenCalled();
    expect(createTag).not.toHaveBeenCalled();
  });

  test('creates a signed tag by default', async () => {
    const { performRelease } = await import('./release.ts');

    await performRelease({
      cwd: '/repo',
      dryRun: false,
      logger: {
        info: () => {},
        start: () => {},
      },
      releaseType: 'minor',
    });

    expect(createTag).toHaveBeenCalledWith(
      '/repo',
      'v0.1.0',
      'release: v0.1.0',
      {
        sign: true,
      },
    );
  });

  test('bumps from the current package version when tags lag behind', async () => {
    const { performRelease } = await import('./release.ts');

    readPackageVersion.mockResolvedValue('0.0.4');

    await performRelease({
      cwd: '/repo',
      dryRun: false,
      logger: {
        info: () => {},
        start: () => {},
      },
      releaseType: 'patch',
    });

    expect(createCommit).toHaveBeenCalledWith('/repo', 'chore: release v0.0.5');
    expect(createTag).toHaveBeenCalledWith(
      '/repo',
      'v0.0.5',
      'release: v0.0.5',
      {
        sign: true,
      },
    );
  });
});
