import { loadConfig } from '@/lib/config.js';
import { getDbConfigs } from './index.js';

/**
 * Default export for MikroORM CLI.
 * CLI tools (mikro-orm migration:create, etc.) require a default export.
 * This uses top-level await to load config and return the appropriate config.
 */
const config = await loadConfig();
export default getDbConfigs(config);
