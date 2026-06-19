import type { Options } from '@mikro-orm/core';
import { postgres } from './postgres.ts';

const options = await postgres({
  host: process.env['TINYAUTH_MIGRATION_POSTGRES_HOST'] ?? 'localhost',
  name: process.env['TINYAUTH_MIGRATION_POSTGRES_DB'] ?? 'tinyauth',
  password: process.env['TINYAUTH_MIGRATION_POSTGRES_PASSWORD'] ?? 'tinyauth',
  port: Number(process.env['TINYAUTH_MIGRATION_POSTGRES_PORT'] ?? '5432'),
  user: process.env['TINYAUTH_MIGRATION_POSTGRES_USER'] ?? 'tinyauth',
}).getMikroOrmOptions();

const config: Partial<Options> = {
  ...options,
  driverOptions: {
    ssl: false,
  },
  migrations: {
    ...options.migrations,
    path: './src/migrations/postgres',
  },
};

export default config;
