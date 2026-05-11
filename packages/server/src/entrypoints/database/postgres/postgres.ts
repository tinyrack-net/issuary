import { defineConfig, type MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SeedManager } from '@mikro-orm/seeder';
import type { DatabaseConfig } from '../../../lib/config/index.ts';
import { getDatabaseEntities } from '../../../lib/database/entities.ts';
import { POSTGRES_MIGRATIONS } from '../../../migrations/postgres/index.ts';
import compiledFunctions from './compiled-functions.js';

export function postgres(database: {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}): DatabaseConfig {
  return {
    getMikroOrmOptions: async () => {
      return defineConfig({
        driver: PostgreSqlDriver,
        compiledFunctions: compiledFunctions,
        entities: [...getDatabaseEntities()],
        host: database.host,
        port: database.port,
        dbName: database.name,
        user: database.user,
        password: database.password,
        extensions: [SeedManager, Migrator],
        migrations: {
          migrationsList: POSTGRES_MIGRATIONS,
        },
        driverOptions: {
          ssl: true,
        },
        debug: false,
      });
    },
    initialize: async (orm: MikroORM) => {
      await orm.migrator.up();
    },
  };
}
