import type { Options } from '@mikro-orm/core';
import type {
  AppConfigDatabasePostgres,
  AppConfigDatabaseSqlite,
} from './lib/config/schema.js';

interface DatabaseConfigRuntime {
  getMikroOrmOptions: () => Promise<Options>;
}

export interface ComposedDatabaseConfigPostgres
  extends AppConfigDatabasePostgres,
    DatabaseConfigRuntime {}

export interface ComposedDatabaseConfigSqlite
  extends AppConfigDatabaseSqlite,
    DatabaseConfigRuntime {}

export type ComposedDatabaseConfig =
  | ComposedDatabaseConfigPostgres
  | ComposedDatabaseConfigSqlite;

export function postgres(
  database: AppConfigDatabasePostgres,
): ComposedDatabaseConfigPostgres {
  return {
    ...database,
    getMikroOrmOptions: async () => {
      const { mikroormPostgresConfig } = await import('./db/postgres.js');
      return mikroormPostgresConfig(database);
    },
  };
}

export function sqlite(
  database: AppConfigDatabaseSqlite,
): ComposedDatabaseConfigSqlite {
  return {
    ...database,
    getMikroOrmOptions: async () => {
      const { mikroormSqliteConfig } = await import('./db/sqlite.js');
      return mikroormSqliteConfig(database);
    },
  };
}
