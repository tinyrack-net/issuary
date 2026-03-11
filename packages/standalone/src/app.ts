import { createApp } from '@tinyauth/backend';
import type { FrontendConfig } from '@tinyauth/backend/frontend';
import { interpolateHtmlResponse } from '@tinyauth/backend/frontend';
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
    const hasVariables = Object.keys(frontend.html_variables).length > 0;

    frontendHandler =
      frontend.mode === 'proxy'
        ? createProxyHandler({
            upstream: frontend.path,
            onResponse: hasVariables
              ? (res) => interpolateHtmlResponse(res, frontend.html_variables)
              : undefined,
          })
        : createStaticHandler({
            publicPath: frontend.path,
            htmlVariables: frontend.html_variables,
          });
  }

  return createApp({
    config: {
      ...backendConfig,
      frontend: frontendHandler,
    },
  });
}
