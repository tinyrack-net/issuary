import type { Options } from '@mikro-orm/core';
import { postgres } from './postgres.ts';

const options = await postgres({
  host: process.env['ISSUARY_MIGRATION_POSTGRES_HOST'] ?? 'localhost',
  name: process.env['ISSUARY_MIGRATION_POSTGRES_DB'] ?? 'issuary',
  password: process.env['ISSUARY_MIGRATION_POSTGRES_PASSWORD'] ?? 'issuary',
  port: Number(process.env['ISSUARY_MIGRATION_POSTGRES_PORT'] ?? '5432'),
  user: process.env['ISSUARY_MIGRATION_POSTGRES_USER'] ?? 'issuary',
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
