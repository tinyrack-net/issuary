import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execaNode } from 'execa';
import { waitForReady } from './wait-for-ready.ts';

const CLI_PATH = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));

const DIST_CLI_PATH = fileURLToPath(
  new URL('../../dist/cli.js', import.meta.url),
);

const CWD = fileURLToPath(new URL('../../', import.meta.url));

const require = createRequire(import.meta.url);
const TSX_IMPORT = pathToFileURL(require.resolve('tsx')).href;
const NODE_OPTIONS = ['--conditions=@tinyauth/source', '--import', TSX_IMPORT];
const LONG_RUNNING_CLI_TIMEOUT_MS = 180_000;
const USE_BUILT_CLI = process.env['TINYAUTH_E2E_BUILT_CLI'] === '1';

interface SpawnCliOptions {
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

type CliProcess =
  | ReturnType<typeof spawnCli>
  | ReturnType<typeof spawnBuiltCli>;

function spawnCli(options: SpawnCliOptions) {
  const { args, cwd = CWD, env, timeout = 60_000 } = options;
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
  const { args, cwd = CWD, env, timeout = 60_000 } = options;
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
  return await (USE_BUILT_CLI ? spawnBuiltCli(options) : spawnCli(options));
}

export async function runBuiltCli(options: SpawnCliOptions) {
  return await spawnBuiltCli(options);
}

export async function waitForCliReady(
  cliProcess: CliProcess,
  port: number,
): Promise<Response> {
  const processExit = cliProcess.then((result) => {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    const outputSuffix = output ? `\n${output}` : '';
    throw new Error(
      `CLI exited before port ${port} became ready (exit ${result.exitCode})${outputSuffix}`,
    );
  });

  return await Promise.race([waitForReady(port), processExit]);
}

/**
 * Start a long-lived CLI command (e.g. serve).
 * Returns the subprocess handle — caller manages lifecycle.
 */
export function startCli(options: SpawnCliOptions) {
  const start = USE_BUILT_CLI ? spawnBuiltCli : spawnCli;
  return start({
    ...options,
    timeout: Math.max(options.timeout ?? 0, LONG_RUNNING_CLI_TIMEOUT_MS),
  });
}

export function startBuiltCli(options: SpawnCliOptions) {
  return spawnBuiltCli({
    ...options,
    timeout: Math.max(options.timeout ?? 0, LONG_RUNNING_CLI_TIMEOUT_MS),
  });
}

export async function stopCliProcess(
  cliProcess: CliProcess | undefined,
): Promise<void> {
  if (!cliProcess || cliProcess.killed) {
    return;
  }

  cliProcess.kill('SIGKILL');
  await cliProcess;
}
