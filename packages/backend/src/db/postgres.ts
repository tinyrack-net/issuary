import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Options, ReflectMetadataProvider } from '@mikro-orm/core';
import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { AppConfigs } from '@/lib/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const mikroormPostgresConfig = (): Options => {
  if (AppConfigs.database.type !== 'postgres') {
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
    host: AppConfigs.database.host,
    port: AppConfigs.database.port,
    dbName: AppConfigs.database.name,
    user: AppConfigs.database.user,
    password: AppConfigs.database.password,
    driverOptions: {
      connection: {
        ssl: true,
      },
    },
    debug: true,
  });
};
