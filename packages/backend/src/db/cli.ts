import { loadConfig, resolveConfig } from '#backend/lib/config/index.js';
import { getDbConfigs } from './index.js';

/**
 * Default export for MikroORM CLI.
 * CLI tools (mikro-orm migration:create, etc.) require a default export.
 * This uses top-level await to load config and return the appropriate config.
 */
const externalConfig = loadConfig();
const config = await resolveConfig(externalConfig);
export default getDbConfigs(config);
