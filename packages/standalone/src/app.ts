import { createApp } from '@tinyrack/issuary-server';
import type { StandaloneConfigInput } from './lib/config/index.ts';
import { resolveConfig } from './lib/load-config.ts';

export interface CreateStandaloneAppOptions {
  config: StandaloneConfigInput;
}

export async function createStandaloneApp(
  options: CreateStandaloneAppOptions,
): Promise<Awaited<ReturnType<typeof createApp>>> {
  const config = await resolveConfig(options.config);
  return createApp(config);
}
