import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const resolveFromFrontend = createRequire(
  path.join(repositoryRoot, 'packages/frontend/package.json'),
).resolve;

async function expectSameBytes(packagePath: string, publicPath: string) {
  const [packageAsset, publicAsset] = await Promise.all([
    readFile(resolveFromFrontend(packagePath)),
    readFile(path.join(repositoryRoot, publicPath)),
  ]);

  expect(publicAsset.equals(packageAsset)).toBe(true);
}

describe('synchronized Issuary brand assets', () => {
  test('frontend favicon matches the published SVG', async () => {
    await expectSameBytes(
      '@tinyrack/ui/brand/apps/issuary-app-icon.svg',
      'packages/frontend/public/issuary-app-icon.svg',
    );
  });

  test('frontend Apple Touch Icon matches the published PNG', async () => {
    await expectSameBytes(
      '@tinyrack/ui/brand/apps/issuary-app-icon-512.png',
      'packages/frontend/public/issuary-app-icon-512.png',
    );
  });

  test('documentation favicon matches the published SVG', async () => {
    await expectSameBytes(
      '@tinyrack/ui/brand/apps/issuary-app-icon.svg',
      'packages/homepage/public/favicon.svg',
    );
  });
});
