import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execaNode } from 'execa';

const CLI_PATH = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));

const DIST_CLI_PATH = fileURLToPath(
  new URL('../../dist/cli.js', import.meta.url),
);

const CWD = fileURLToPath(new URL('../../', import.meta.url));

const require = createRequire(import.meta.url);
const TSX_IMPORT = pathToFileURL(require.resolve('tsx')).href;
const NODE_OPTIONS = ['--conditions=@tinyauth/source', '--import', TSX_IMPORT];

interface SpawnCliOptions {
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

function spawnCli(options: SpawnCliOptions) {
  const { args, cwd = CWD, env, timeout = 30_000 } = options;
  return execaNode(CLI_PATH, args, {
    reject: false,
    timeout,
    cwd,
    nodeOptions: NODE_OPTIONS,
    env: {
      ...env,
      CONFIG_PATH: '',
      NODE_OPTIONS: '',
    },
  });
}

function spawnBuiltCli(options: SpawnCliOptions) {
  const { args, cwd = CWD, env, timeout = 30_000 } = options;
  return execaNode(DIST_CLI_PATH, args, {
    reject: false,
    timeout,
    cwd,
    env: {
      ...env,
      CONFIG_PATH: '',
      NODE_OPTIONS: '',
    },
  });
}

/**
 * Run a short-lived CLI command and wait for it to exit.
 */
export async function runCli(options: SpawnCliOptions) {
  return await spawnCli(options);
}

export async function runBuiltCli(options: SpawnCliOptions) {
  return await spawnBuiltCli(options);
}

/**
 * Start a long-lived CLI command (e.g. serve).
 * Returns the subprocess handle — caller manages lifecycle.
 */
export function startCli(options: SpawnCliOptions) {
  return spawnCli(options);
}

export function startBuiltCli(options: SpawnCliOptions) {
  return spawnBuiltCli(options);
}
