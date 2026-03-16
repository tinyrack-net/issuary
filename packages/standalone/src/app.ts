import { createApp } from '@tinyauth/backend';
import type { FrontendConfig } from '@tinyauth/backend/frontend';
import { createProxyHandler } from '@tinyauth/backend/frontend/proxy';
import { createStaticHandler } from '@tinyauth/backend/frontend/static';
import type { StandaloneConfigInput } from './lib/config/index.js';
import { resolveStandaloneConfig } from './lib/load-config.js';

export interface CreateStandaloneAppOptions {
  config: StandaloneConfigInput;
}

export async function createStandaloneApp(options: CreateStandaloneAppOptions) {
  const config = await resolveStandaloneConfig(options.config);
  const { frontend, ...backendConfig } = config;

  let frontendHandler: FrontendConfig | undefined;

  if (frontend.enabled) {
    frontendHandler =
      frontend.mode === 'proxy'
        ? createProxyHandler({
            upstream: frontend.path,
            htmlVariables: frontend.html_variables,
          })
        : createStaticHandler({
            publicPath: frontend.path,
            htmlVariables: frontend.html_variables,
          });
  }

  return createApp({
    ...backendConfig,
    frontend: frontendHandler,
  });
}
