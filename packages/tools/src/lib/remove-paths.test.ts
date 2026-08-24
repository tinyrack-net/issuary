import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { removePaths } from './remove-paths.ts';

describe('removePaths', () => {
  it('removes files and directories recursively and ignores missing paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'issuary-remove-paths-'));
    const nestedDir = join(root, 'nested');
    const nestedFile = join(nestedDir, 'file.txt');
    const missingPath = join(root, 'missing');

    await mkdir(nestedDir, { recursive: true });
    await writeFile(nestedFile, 'content');

    await removePaths([nestedDir, missingPath]);

    await expect(readFile(nestedFile, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
