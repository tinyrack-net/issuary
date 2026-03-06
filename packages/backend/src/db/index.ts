import type { Options } from '@mikro-orm/core';

type DatabaseConfig =
  | { type: 'sqlite'; path: string; test: boolean }
  | {
      type: 'postgres';
      host: string;
      port: number;
      user: string;
      password: string;
      name: string;
    };

/**
 * Get MikroORM config from AppConfig.
 * Used by the application at runtime.
 */
export async function getDbConfigs(database: DatabaseConfig): Promise<Options> {
  switch (database.type) {
    case 'postgres': {
      const { mikroormPostgresConfig } = await import('./postgres.js');
      return mikroormPostgresConfig(database);
    }
    case 'sqlite': {
      const { mikroormSqliteConfig } = await import('./sqlite.js');
      return mikroormSqliteConfig(database);
    }
  }
}
