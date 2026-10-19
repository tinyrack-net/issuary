import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * MikroORM emits its compiled hydrators and comparators with trailing
 * whitespace on otherwise empty lines. The files are tracked in git, so without
 * this pass every `mikro-orm compile` would leave the working tree dirty and
 * fail `git diff --check`.
 */
const GENERATED_FILES: readonly string[] = [
  'packages/server/src/entrypoints/database/postgres/compiled-functions.js',
  'packages/server/src/entrypoints/database/sqlite/compiled-functions.js',
];

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

for (const relativePath of GENERATED_FILES) {
  const filePath = path.join(repositoryRoot, relativePath);
  const source = await readFile(filePath, 'utf8');
  const trimmedLines = source
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/u, ''));
  const normalized = `${trimmedLines.join('\n').replace(/\n+$/u, '')}\n`;

  if (normalized !== source) {
    await writeFile(filePath, normalized);
  }
}
