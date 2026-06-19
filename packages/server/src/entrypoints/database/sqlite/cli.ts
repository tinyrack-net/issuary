import type { Options } from '@mikro-orm/core';
import { sqlite } from './sqlite.ts';

const options = await sqlite({
  path: process.env['TINYAUTH_MIGRATION_SQLITE_DB_PATH'] ?? '/path/some',
  test: !process.env['TINYAUTH_MIGRATION_SQLITE_DB_PATH'],
}).getMikroOrmOptions();

const config: Partial<Options> = {
  ...options,
  migrations: {
    ...options.migrations,
    path: './src/migrations/sqlite',
  },
};

export default config;
