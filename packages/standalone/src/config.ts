export {
  type ResolvedStandaloneConfig,
  type ResolvedStandaloneFrontendConfig,
  type StandaloneConfig,
  type StandaloneConfigInput,
  StandaloneConfigSchema,
  type StandaloneFrontendConfig,
  type StandaloneFrontendConfigInput,
} from '#standalone/lib/config/schema.js';
export {
  loadConfigFromPath as loadConfig,
  loadResolvedConfig,
  resolveStandaloneConfig,
} from '#standalone/lib/load-config.js';
