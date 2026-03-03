import { createApp } from '@tinyauth/backend';
import type { StandaloneConfigInput } from './lib/config/schema.js';
import { resolveStandaloneConfig } from './lib/load-config.js';
import { registerFrontendRoutes } from './lib/register-frontend-routes.js';

export interface CreateStandaloneAppOptions {
  config: StandaloneConfigInput;
}

export async function createStandaloneApp(options: CreateStandaloneAppOptions) {
  const config = await resolveStandaloneConfig(options.config);
  const result = await createApp({ config });
  registerFrontendRoutes(result.app, {
    frontend: config.app.frontend,
    htmlVariables: config.app.html_variables,
    logger: result.logger,
  });
  return result;
}
