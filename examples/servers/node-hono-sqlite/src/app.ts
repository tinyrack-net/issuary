import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '@tinyauth/backend';
import { sqlite } from '@tinyauth/backend/database/sqlite';
import { createStaticHandler } from '@tinyauth/backend/frontend/static';

const exampleRoot = process.cwd();
const repoRoot = path.resolve(exampleRoot, '../../..');
const frontendPublicPath = path.resolve(repoRoot, 'packages/backend/public');
const frontendIndexPath = path.join(frontendPublicPath, 'index.html');
const dataDir = path.join(exampleRoot, 'data');
const sqlitePath = path.join(dataDir, 'tinyauth.db');

export async function createNodeHonoSqliteExampleApp(
  options: { test?: boolean; publicOrigin?: string } = {},
) {
  const { test = false, publicOrigin = 'http://localhost:3000' } = options;

  await fs.promises.access(frontendIndexPath, fs.constants.R_OK).catch(() => {
    throw new Error(
      `TinyAuth frontend assets were not found at ${frontendIndexPath}. ` +
        'Run `pnpm --filter @tinyauth/frontend build` first.',
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
        TITLE: 'TinyAuth Hono Example',
        DESCRIPTION:
          'TinyAuth running in library mode with Hono, Node.js, and SQLite',
        FAVICON_URL: '/vite.svg',
      },
    }),
  });
}
