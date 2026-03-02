import type { Options } from '@mikro-orm/core';
import type { AppConfigDatabase } from '#backend/lib/config/schema.js';
import { mikroormPostgresConfig } from './postgres.js';
import { mikroormSqliteConfig } from './sqlite.js';

/**
 * Get MikroORM config from AppConfig.
 * Used by the application at runtime.
 */
export function getDbConfigs(database: AppConfigDatabase): Options {
  switch (database.type) {
    case 'postgres': {
      return mikroormPostgresConfig(database);
    }
    case 'sqlite': {
      return mikroormSqliteConfig(database);
    }
  }
}
