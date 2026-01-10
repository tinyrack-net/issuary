import { AppConfigs } from '@/lib/config.js';
import { mikroormMemoryConfig } from './memory.js';
import { mikroormPostgresConfig } from './postgres.js';
import { mikroormSqliteConfig } from './sqlite.js';

const configs = (() => {
  switch (AppConfigs.database.type) {
    case 'postgres': {
      return mikroormPostgresConfig();
    }
    case 'sqlite': {
      return mikroormSqliteConfig();
    }
    case 'memory': {
      return mikroormMemoryConfig();
    }
  }
})();

export default configs;
