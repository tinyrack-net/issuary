import { createApp } from '@tinyauth/backend';
import type { StandaloneConfigInput } from './lib/config/index.ts';
import { resolveConfig } from './lib/load-config.ts';

export interface CreateStandaloneAppOptions {
  config: StandaloneConfigInput;
}

export async function createStandaloneApp(options: CreateStandaloneAppOptions) {
  const config = await resolveConfig(options.config);
  return createApp(config);
}
