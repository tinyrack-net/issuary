import {
  buildApplication,
  type CommandContext,
  run,
  type StricliDynamicCommandContext,
} from '@stricli/core';
import packageJson from '../../package.json' with { type: 'json' };
import { commands } from './commands/index.ts';

export type TinyAuthCliContext = CommandContext;

export const app = buildApplication(commands, {
  name: 'tinyauth',
  versionInfo: {
    currentVersion: packageJson.version,
  },
  scanner: {
    caseStyle: 'allow-kebab-for-camel',
  },
  documentation: {
    useAliasInUsageLine: true,
  },
});

export async function runCli(
  args: readonly string[],
  context: StricliDynamicCommandContext<TinyAuthCliContext>,
): Promise<void> {
  await run(app, args, context);
}
