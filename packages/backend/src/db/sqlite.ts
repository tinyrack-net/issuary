import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, LibSqlDriver } from '@mikro-orm/libsql';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import type { ResolvedAppConfig } from '../lib/config/index.js';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import type { Options } from '@mikro-orm/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const mikroormSqliteConfig = (config: ResolvedAppConfig): Options => {
  if (config.database.type !== 'sqlite') {
    throw new Error('Database type is not sqlite');
  }
  return defineConfig({
    metadataProvider: ReflectMetadataProvider,
    driver: LibSqlDriver,
    dbName: config.database.path,
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
