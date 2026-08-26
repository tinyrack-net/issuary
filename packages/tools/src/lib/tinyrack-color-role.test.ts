import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const sourceExtensions = new Set(['.css', '.ts', '.tsx']);
const fillTextPattern =
  /text-tinyrack-(primary|info|success|warning|danger)(?=[\s"'\x60])/g;
const fillColorPattern =
  /color:\s*var\(--tinyrack-(primary|info|success|warning|danger)\)/g;

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listSourceFiles(entryPath);
      return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );
  return files.flat();
}

describe('Tinyrack semantic color roles', () => {
  test('reserves intent fill colors for filled surfaces', async () => {
    const repositoryRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../..',
    );
    const sourceRoots = [
      'packages/frontend/src',
      'packages/homepage/app',
      'examples/clients/react-spa/src',
    ];
    const sourceFiles = (
      await Promise.all(
        sourceRoots.map((sourceRoot) =>
          listSourceFiles(path.join(repositoryRoot, sourceRoot)),
        ),
      )
    ).flat();
    const violations: string[] = [];

    for (const sourceFile of sourceFiles) {
      const source = await readFile(sourceFile, 'utf8');
      const relativePath = path.relative(repositoryRoot, sourceFile);
      for (const pattern of [fillTextPattern, fillColorPattern]) {
        for (const match of source.matchAll(pattern)) {
          violations.push(`${relativePath}: ${match[0]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
