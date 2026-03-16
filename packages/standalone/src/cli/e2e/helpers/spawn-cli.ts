import { fileURLToPath } from 'node:url';
import { type ExecaChildProcess, execaNode, type Result } from 'execa';

const CLI_PATH = fileURLToPath(
  new URL('../../../../src/cli.ts', import.meta.url),
);

const CWD = fileURLToPath(new URL('../../../../', import.meta.url));

const NODE_OPTIONS = ['--conditions=@tinyauth/source', '--import', 'tsx'];

interface SpawnCliOptions {
  args: string[];
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Run a short-lived CLI command and wait for it to exit.
 */
export function runCli(
  options: SpawnCliOptions,
): Promise<Result<{ reject: false }>> {
  const { args, env, timeout = 15_000 } = options;
  return execaNode(CLI_PATH, args, {
    reject: false,
    timeout,
    cwd: CWD,
    nodeOptions: NODE_OPTIONS,
    env: {
      ...env,
      CONFIG_PATH: '',
    },
  });
}

/**
 * Start a long-lived CLI command (e.g. serve).
 * Returns the child process handle — caller manages lifecycle.
 */
export function startCli(
  options: SpawnCliOptions,
): ExecaChildProcess<{ reject: false }> {
  const { args, env, timeout = 15_000 } = options;
  return execaNode(CLI_PATH, args, {
    reject: false,
    timeout,
    cwd: CWD,
    nodeOptions: NODE_OPTIONS,
    env: {
      ...env,
      CONFIG_PATH: '',
    },
  });
}
