import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const frontendPackageJson = path.join(
  repositoryRoot,
  'packages/frontend/package.json',
);
const resolveFromFrontend = createRequire(frontendPackageJson).resolve;
const checkOnly = process.argv.includes('--check');
const targetArgument = process.argv.find((argument) =>
  argument.startsWith('--target='),
);
const target = targetArgument?.slice('--target='.length);

if (target && target !== 'frontend' && target !== 'homepage') {
  throw new Error(`Unknown brand asset target: ${target}`);
}

const assets = [
  {
    packagePath: '@tinyrack/ui/brand/apps/issuary-app-icon.svg',
    destinations: {
      frontend: 'packages/frontend/public/issuary-app-icon.svg',
      homepage: 'packages/homepage/public/favicon.svg',
    },
  },
  {
    packagePath: '@tinyrack/ui/brand/apps/issuary-app-icon-512.png',
    destinations: {
      frontend: 'packages/frontend/public/issuary-app-icon-512.png',
    },
  },
] as const;

let mismatchFound = false;

for (const asset of assets) {
  const source = await readFile(resolveFromFrontend(asset.packagePath));

  for (const [destinationTarget, relativeDestination] of Object.entries(
    asset.destinations,
  )) {
    if (target && target !== destinationTarget) {
      continue;
    }

    const destination = path.join(repositoryRoot, relativeDestination);

    if (checkOnly) {
      const current = await readFile(destination).catch(() => undefined);
      if (!current?.equals(source)) {
        mismatchFound = true;
        console.error(`${relativeDestination} is not synchronized.`);
      }
      continue;
    }

    await writeFile(destination, source);
    console.log(`Synchronized ${relativeDestination}`);
  }
}

if (mismatchFound) {
  process.exitCode = 1;
}
