import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Options, ReflectMetadataProvider } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import { defineConfig, SqliteDriver } from '@mikro-orm/sqlite';
import { AppConfigs } from '../lib/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const mikroormMemoryConfig = (): Options => {
  if (AppConfigs.database.type !== 'memory') {
    throw new Error('Database type is not memory');
  }
  return defineConfig({
    metadataProvider: ReflectMetadataProvider,
    driver: SqliteDriver,
    dbName: ':memory:',
    entities: [path.join(__dirname, '../**/*.entity.js')],
    entitiesTs: [path.join(__dirname, '../**/*.entity.ts')],
    migrations: {
      path: path.join(__dirname, '../migrations/sqlite'),
      pathTs: path.join(__dirname, '../migrations/sqlite'),
      glob: '!(*.d).{ts,js}',
    },
    extensions: [SeedManager, Migrator],
    debug: true,
  });
};
