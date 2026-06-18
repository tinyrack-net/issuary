import { rm } from 'node:fs/promises';

export async function removePaths(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map((targetPath) => rm(targetPath, { recursive: true, force: true })),
  );
}
