import {
  type CreateAppRuntimeOptions,
  createApp,
} from '@tinyrack/issuary-server';
import type { StandaloneConfigInput } from './lib/config/index.ts';
import { resolveConfig } from './lib/load-config.ts';

export interface CreateStandaloneAppOptions {
  config: StandaloneConfigInput;
  runtimeOptions?: CreateAppRuntimeOptions | undefined;
}

export async function createStandaloneApp(
  options: CreateStandaloneAppOptions,
): Promise<Awaited<ReturnType<typeof createApp>>> {
  const config = await resolveConfig(options.config);
  return createApp(config, options.runtimeOptions);
}
