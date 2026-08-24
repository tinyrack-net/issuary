#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cliUrl = new URL('../dist/cli.js', import.meta.url);

if (!existsSync(fileURLToPath(cliUrl))) {
  console.error(
    'Issuary standalone CLI has not been built yet. Run `pnpm --filter @tinyrack/issuary-standalone build` first.',
  );
  process.exitCode = 1;
} else {
  await import(cliUrl.href);
}
