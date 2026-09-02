import path from 'node:path';
import { createApp } from '@tinyrack/issuary-server';
import { sqlite } from '@tinyrack/issuary-server/database/sqlite';

const exampleRoot = process.cwd();
const dataDir = path.join(exampleRoot, 'data');
const sqlitePath = path.join(dataDir, 'issuary.db');

export async function createNodeHonoSqliteExampleApp(
  options: { test?: boolean; publicOrigin?: string } = {},
) {
  const { test = false, publicOrigin = 'http://localhost:3000' } = options;

  if (!test) {
    const fs = await import('node:fs');
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
    branding: {
      title: { en: 'Issuary Hono Example' },
      subtitle: {
        en: 'Issuary running in library mode with Hono, Node.js, and SQLite',
      },
    },
  });
}
