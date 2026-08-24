import {
  buildApplication,
  type CommandContext,
  run,
  type StricliDynamicCommandContext,
} from '@stricli/core';
import packageJson from '../../package.json' with { type: 'json' };
import { commands } from './commands/index.ts';

export type IssuaryCliContext = CommandContext;

export const app = buildApplication(commands, {
  name: 'issuary',
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
  context: StricliDynamicCommandContext<IssuaryCliContext>,
): Promise<void> {
  await run(app, args, context);
}
