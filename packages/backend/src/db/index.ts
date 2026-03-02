import type { Options } from '@mikro-orm/core';
import type { AppConfigDatabase } from '#backend/lib/config/schema.js';

/**
 * Get MikroORM config from AppConfig.
 * Used by the application at runtime.
 */
export async function getDbConfigs(
  database: AppConfigDatabase,
): Promise<Options> {
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
