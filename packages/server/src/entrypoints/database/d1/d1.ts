/// <reference types="@cloudflare/workers-types" />
import { defineConfig, type MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import { SqliteDriver } from '@mikro-orm/sql';
import { D1Dialect } from 'kysely-d1';
import type { DatabaseConfig } from '../../../lib/config/index.ts';
import { resolveCompiledFunctionsForEntities } from '../../../lib/database/compiled-functions.ts';
import {
  getDatabaseEntities,
  getDatabaseEntitiesWithMetadata,
} from '../../../lib/database/entities.ts';
import { D1_MIGRATIONS } from '../../../migrations/d1/index.ts';
import compiledFunctions from './compiled-functions.js';

export function d1(database: { database: D1Database }): DatabaseConfig {
  return {
    getMikroOrmOptions: async () => {
      return defineConfig({
        driver: SqliteDriver,
        compiledFunctions: resolveCompiledFunctionsForEntities(
          getDatabaseEntitiesWithMetadata(),
          compiledFunctions,
        ),
        dbName: 'd1',
        driverOptions: new D1Dialect({ database: database.database }),
        implicitTransactions: false,
        entities: [...getDatabaseEntities()],
        extensions: [SeedManager, Migrator],
        migrations: {
          migrationsList: D1_MIGRATIONS,
          transactional: false,
          allOrNothing: false,
        },
        debug: false,
      });
    },
    initialize: async (orm: MikroORM) => {
      await orm.migrator.up();
    },
  };
}
