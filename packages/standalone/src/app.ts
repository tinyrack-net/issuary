import { createApp } from '@tinyauth/backend';
import type { StandaloneConfigInput } from './lib/config/index.js';
import { resolveConfig } from './lib/load-config.js';

export interface CreateStandaloneAppOptions {
  config: StandaloneConfigInput;
}

export async function createStandaloneApp(options: CreateStandaloneAppOptions) {
  const config = await resolveConfig(options.config);
  return createApp(config);
}
