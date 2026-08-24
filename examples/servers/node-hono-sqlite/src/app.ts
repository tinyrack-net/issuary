import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '@tinyrack/issuary-server';
import { sqlite } from '@tinyrack/issuary-server/database/sqlite';
import { createStaticHandler } from '@tinyrack/issuary-server/frontend/static';

const exampleRoot = process.cwd();
const repoRoot = path.resolve(exampleRoot, '../../..');
const frontendPublicPath = path.resolve(repoRoot, 'packages/server/public');
const frontendIndexPath = path.join(frontendPublicPath, 'index.html');
const dataDir = path.join(exampleRoot, 'data');
const sqlitePath = path.join(dataDir, 'issuary.db');

export async function createNodeHonoSqliteExampleApp(
  options: { test?: boolean; publicOrigin?: string } = {},
) {
  const { test = false, publicOrigin = 'http://localhost:3000' } = options;

  await fs.promises.access(frontendIndexPath, fs.constants.R_OK).catch(() => {
    throw new Error(
      `Issuary frontend assets were not found at ${frontendIndexPath}. ` +
        'Run `pnpm --filter @tinyrack/issuary-frontend build` first.',
    );
  });

  if (!test) {
    await fs.promises.mkdir(dataDir, { recursive: true });
  }

  return createApp({
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
      email_verification_required: false,
    },
    server: {
      public_origin: publicOrigin,
    },
    database: sqlite({
      path: sqlitePath,
      test,
    }),
    logging: {
      level: test ? 'silent' : 'info',
      format: test ? 'json' : 'pretty',
    },
    security: {
      session_secret:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    },
    frontend: createStaticHandler({
      publicPath: frontendPublicPath,
      htmlVariables: {
        TITLE: 'Issuary Hono Example',
        DESCRIPTION:
          'Issuary running in library mode with Hono, Node.js, and SQLite',
        FAVICON_URL: '/vite.svg',
      },
    }),
  });
}
