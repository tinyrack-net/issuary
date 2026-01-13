import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Options, ReflectMetadataProvider } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SeedManager } from '@mikro-orm/seeder';
import type { AppConfig } from '@/lib/config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const mikroormPostgresConfig = (config: AppConfig): Options => {
  if (config.database.type !== 'postgres') {
    throw new Error('Database type is not postgres');
  }
  return defineConfig({
    metadataProvider: ReflectMetadataProvider,
    driver: PostgreSqlDriver,
    entities: [path.join(__dirname, '../**/*.entity.js')],
    entitiesTs: [path.join(__dirname, '../**/*.entity.ts')],
    migrations: {
      path: path.join(__dirname, '../migrations/postgres'),
      pathTs: path.join(__dirname, '../migrations/postgres'),
      glob: '!(*.d).{ts,js}',
    },
    host: config.database.host,
    port: config.database.port,
    dbName: config.database.name,
    user: config.database.user,
    password: config.database.password,
    extensions: [SeedManager, Migrator],
    driverOptions: {
      connection: {
        ssl: true,
      },
    },
    debug: true,
  });
};
