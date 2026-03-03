import { getDbConfigs } from '@tinyauth/backend/db';
import { loadConfig } from '#standalone/lib/load-config.js';

/**
 * Default export for MikroORM CLI.
 * CLI tools (mikro-orm migration:create, etc.) require a default export.
 * This uses top-level await to load config and return the appropriate config.
 */
const config = loadConfig();

export default await getDbConfigs(config.database);
