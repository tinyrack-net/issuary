import { defineConfig, type MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import { NodeSqliteDialect, SqliteDriver } from '@mikro-orm/sql';
import type { DatabaseConfig } from '../../../lib/config/index.ts';
import { resolveCompiledFunctionsForEntities } from '../../../lib/database/compiled-functions.ts';
import {
  getDatabaseEntities,
  getDatabaseEntitiesWithMetadata,
} from '../../../lib/database/entities.ts';
import compiledFunctions from './compiled-functions.js';

export function sqlite(database: {
  path: string;
  test: boolean;
}): DatabaseConfig {
  const dbName = database.test ? ':memory:' : database.path;

  return {
    getMikroOrmOptions: async () => {
      return defineConfig({
        driver: SqliteDriver,
        dbName: dbName,
        driverOptions: new NodeSqliteDialect(dbName),
        compiledFunctions: resolveCompiledFunctionsForEntities(
          getDatabaseEntitiesWithMetadata(),
          compiledFunctions,
        ),
        entities: [...getDatabaseEntities()],
        extensions: [SeedManager, Migrator],
        debug: false,
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
