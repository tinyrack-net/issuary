import type { Options } from '@mikro-orm/core';
import type { AppConfig } from '@/lib/config.js';
import { mikroormMemoryConfig } from './memory.js';
import { mikroormPostgresConfig } from './postgres.js';
import { mikroormSqliteConfig } from './sqlite.js';

/**
 * Get MikroORM config from AppConfig.
 * Used by the application at runtime.
 */
export function getDbConfigs(config: AppConfig): Options {
  switch (config.database.type) {
    case 'postgres': {
      return mikroormPostgresConfig(config);
    }
    case 'sqlite': {
      return mikroormSqliteConfig(config);
    }
    case 'memory': {
      return mikroormMemoryConfig(config);
    }
  }
}
