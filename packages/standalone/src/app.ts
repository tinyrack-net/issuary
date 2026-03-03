import { createApp } from '@tinyauth/backend';
import type {
  ResolvedStandaloneConfig,
  StandaloneConfig,
  StandaloneConfigInput,
} from './lib/config/schema.js';
import {
  loadResolvedConfig,
  resolveStandaloneConfig,
  toBackendConfig,
} from './lib/load-config.js';
import { registerFrontendRoutes } from './lib/register-frontend-routes.js';

export interface CreateStandaloneAppOptions {
  config?: StandaloneConfigInput | StandaloneConfig | undefined;
  configPath?: string | undefined;
}

export async function createStandaloneApp(
  options?: CreateStandaloneAppOptions,
) {
  const config = await resolveAppConfig(options);
  const result = await createApp({ config: toBackendConfig(config) });
  registerFrontendRoutes(result.app, {
    frontend: config.app.frontend,
    htmlVariables: config.app.html_variables,
    logger: result.logger,
  });
  return result;
}

async function resolveAppConfig(
  options?: CreateStandaloneAppOptions,
): Promise<ResolvedStandaloneConfig> {
  if (options?.config !== undefined) {
    return resolveStandaloneConfig(options.config);
  }

  return loadResolvedConfig({
    configPath: options?.configPath,
  });
}
