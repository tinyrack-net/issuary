import path from 'node:path';
import z from 'zod';
import {
  createCommit,
  createTag,
  getRepoRoot,
  getWorktreeStatus,
  hasTag,
  listVersionTags,
  stageFiles,
} from './git.ts';
import { readPackageVersion, writePackageVersion } from './package-json.ts';
import {
  bumpVersion,
  formatVersion,
  formatVersionTag,
  parseVersionTag,
} from './version.ts';

const RELEASE_TARGETS = [
  'packages/server/package.json',
  'packages/frontend/package.json',
  'packages/standalone/package.json',
] as const;

export const releaseTypeSchema = z.enum(['patch', 'minor', 'major']);

export type ReleaseType = z.infer<typeof releaseTypeSchema>;

export type ReleaseLogger = {
  info: (message: string) => void;
  start: (message: string) => void;
};

export type ReleaseResult = {
  dryRun: boolean;
  previousTag: string;
  tag: string;
  version: string;
};

type PerformReleaseOptions = {
  cwd: string;
  dryRun: boolean;
  logger: ReleaseLogger;
  releaseType: ReleaseType;
  signTag?: boolean;
};

export async function performRelease(
  options: PerformReleaseOptions,
): Promise<ReleaseResult> {
  const repoRoot = await getRepoRoot(options.cwd);
  const worktreeStatus = await getWorktreeStatus(repoRoot);

  if (!options.dryRun && worktreeStatus.length > 0) {
    throw new Error('Git worktree must be clean before releasing');
  }

  const tags = await listVersionTags(repoRoot);
  const latestTag = tags[0];

  if (!latestTag) {
    throw new Error('No release tag found. Create a v* tag first.');
  }

  const currentVersion = parseVersionTag(latestTag);
  const nextVersion = bumpVersion(currentVersion, options.releaseType);
  const nextTag = formatVersionTag(nextVersion);
  const nextVersionText = formatVersion(nextVersion);

  if (await hasTag(repoRoot, nextTag)) {
    throw new Error(`Release tag already exists: ${nextTag}`);
  }

  const currentPackageVersions = await Promise.all(
    RELEASE_TARGETS.map(async (targetPath) => {
      const absolutePath = path.join(repoRoot, targetPath);
      return await readPackageVersion(absolutePath);
    }),
  );

  const expectedVersion = currentPackageVersions[0];

  if (!expectedVersion) {
    throw new Error('Release targets are missing versions');
  }

  const hasMismatchedVersion = currentPackageVersions.some(
    (version) => version !== expectedVersion,
  );

  if (hasMismatchedVersion) {
    throw new Error(
      `Release targets must share the same version. Found: ${currentPackageVersions.join(', ')}`,
    );
  }

  if (options.dryRun) {
    options.logger.start(`Dry run for ${nextTag} from ${latestTag}`);
    if (worktreeStatus.length > 0) {
      options.logger.info(
        'Worktree is dirty; dry run will not modify files or git state',
      );
    }
    for (const targetPath of RELEASE_TARGETS) {
      options.logger.info(`Would update ${targetPath} to ${nextVersionText}`);
    }

    return {
      dryRun: true,
      previousTag: latestTag,
      tag: nextTag,
      version: nextVersionText,
    };
  }

  options.logger.start(`Releasing ${nextTag} from ${latestTag}`);

  for (const targetPath of RELEASE_TARGETS) {
    const absolutePath = path.join(repoRoot, targetPath);
    await writePackageVersion(absolutePath, nextVersionText);
    options.logger.info(`Updated ${targetPath} to ${nextVersionText}`);
  }

  await stageFiles(repoRoot, RELEASE_TARGETS);

  const commitMessage = `chore: release ${nextTag}`;
  const tagMessage = `release: ${nextTag}`;

  await createCommit(repoRoot, commitMessage);
  await createTag(repoRoot, nextTag, tagMessage, {
    sign: options.signTag !== false,
  });

  return {
    dryRun: false,
    previousTag: latestTag,
    tag: nextTag,
    version: nextVersionText,
  };
}
