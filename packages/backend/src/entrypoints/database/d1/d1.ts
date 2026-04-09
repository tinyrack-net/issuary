/// <reference types="@cloudflare/workers-types" />
import { defineConfig, type MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sql';
import { D1Dialect } from 'kysely-d1';
import type { DatabaseConfig } from '../../../lib/config/index.ts';
import { resolveCompiledFunctionsForEntities } from '../../../lib/database/compiled-functions.ts';
import {
  getDatabaseEntities,
  getDatabaseEntitiesWithMetadata,
} from '../../../lib/database/entities.ts';
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
        debug: false,
      });
    },
    initialize: async (_orm: MikroORM) => {
      const schemaSQL = _orm.schema
        .getCreateSchemaSQL({ wrap: false })
        .then((sql) =>
          sql
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        );
      for (const statement of await schemaSQL) {
        try {
          await database.database.exec(statement);
        } catch {
          // ignore "table already exists" errors
        }
      }
    },
  };
}
