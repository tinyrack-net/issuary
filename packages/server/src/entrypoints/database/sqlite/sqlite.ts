import { defineConfig, type MikroORM, type Options } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import { NodeSqliteDialect, SqliteDriver } from '@mikro-orm/sql';
import type { DatabaseConfig } from '../../../lib/config/index.ts';
import { getDatabaseEntities } from '../../../lib/database/entities.ts';
import { SQLITE_MIGRATIONS } from '../../../migrations/sqlite/index.ts';
import compiledFunctions from './compiled-functions.js';

type SqliteDatabaseConfig = {
  path: string;
  test: boolean;
  debug?: Options['debug'];
};

export function sqlite(database: SqliteDatabaseConfig): DatabaseConfig {
  const dbName = database.test ? ':memory:' : database.path;

  return {
    getMikroOrmOptions: async () => {
      return defineConfig({
        driver: SqliteDriver,
        dbName: dbName,
        driverOptions: new NodeSqliteDialect(dbName),
        compiledFunctions: compiledFunctions,
        entities: [...getDatabaseEntities()],
        extensions: [SeedManager, Migrator],
        migrations: {
          migrationsList: SQLITE_MIGRATIONS,
          snapshot: false,
        },
        debug: database.debug ?? false,
      });
    },
    initialize: async (orm: MikroORM) => {
      if (database.test) {
        await orm.schema.refresh();
      } else {
        await orm.migrator.up();
      }
    },
  };
}
