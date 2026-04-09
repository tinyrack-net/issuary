import { beforeEach, describe, expect, test, vi } from 'vitest';

const getRepoRoot = vi.fn();
const getWorktreeStatus = vi.fn();
const hasTag = vi.fn();
const listVersionTags = vi.fn();
const stageFiles = vi.fn();
const createCommit = vi.fn();
const createAnnotatedTag = vi.fn();
const readPackageVersion = vi.fn();
const writePackageVersion = vi.fn();

vi.mock('./git.ts', () => ({
  createAnnotatedTag,
  createCommit,
  getRepoRoot,
  getWorktreeStatus,
  hasTag,
  listVersionTags,
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
    listVersionTags.mockReset();
    stageFiles.mockReset();
    createCommit.mockReset();
    createAnnotatedTag.mockReset();
    readPackageVersion.mockReset();
    writePackageVersion.mockReset();

    getRepoRoot.mockResolvedValue('/repo');
    getWorktreeStatus.mockResolvedValue('');
    listVersionTags.mockResolvedValue(['v0.0.3']);
    hasTag.mockResolvedValue(false);
    readPackageVersion.mockResolvedValue('1.0.0');
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
    expect(createAnnotatedTag).not.toHaveBeenCalled();
  });
});
