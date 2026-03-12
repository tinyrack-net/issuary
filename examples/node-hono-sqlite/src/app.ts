import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '@tinyauth/backend';
import { sqlite } from '@tinyauth/backend/database/sqlite';
import { createStaticHandler } from '@tinyauth/backend/frontend/static';

const exampleRoot = process.cwd();
const repoRoot = path.resolve(exampleRoot, '../..');
const frontendPublicPath = path.resolve(repoRoot, 'packages/backend/public');
const frontendIndexPath = path.join(frontendPublicPath, 'index.html');
const dataDir = path.join(exampleRoot, 'data');
const sqlitePath = path.join(dataDir, 'tinyauth.db');

const HTML_VARIABLES = {
  TITLE: 'TinyAuth Hono Example',
  DESCRIPTION:
    'TinyAuth running in library mode with Hono, Node.js, and SQLite',
  FAVICON_URL: '/vite.svg',
} as const;

const SESSION_SECRET =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const HASH_SECRET = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY';

export interface CreateNodeHonoSqliteExampleAppOptions {
  test?: boolean;
  publicOrigin?: string;
}

async function ensureFrontendAssets(): Promise<void> {
  try {
    await fs.promises.access(frontendIndexPath, fs.constants.R_OK);
  } catch {
    throw new Error(
      `TinyAuth frontend assets were not found at ${frontendIndexPath}. ` +
        'Run `pnpm --filter @tinyauth/frontend build` first.',
    );
  }
}

async function ensureDataDirectory(): Promise<void> {
  await fs.promises.mkdir(dataDir, { recursive: true });
}

export async function createNodeHonoSqliteExampleApp(
  options: CreateNodeHonoSqliteExampleAppOptions = {},
) {
  const { test = false, publicOrigin = 'http://localhost:3000' } = options;

  await ensureFrontendAssets();

  if (!test) {
    await ensureDataDirectory();
  }

  return createApp({
    config: {
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
        session_secret: SESSION_SECRET,
        hash_secret: HASH_SECRET,
      },
      frontend: createStaticHandler({
        publicPath: frontendPublicPath,
        htmlVariables: HTML_VARIABLES,
      }),
    },
  });
}
