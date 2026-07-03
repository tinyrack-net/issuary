import { afterEach, describe, expect, it } from 'vitest';
import { createTestConfigFile } from './helpers/config-factory.ts';
import {
  runBuiltCli,
  startBuiltCli,
  stopCliProcess,
} from './helpers/spawn-cli.ts';
import { waitForReady } from './helpers/wait-for-ready.ts';

function expectGracefulShutdownExitCode(exitCode: number | undefined) {
  if (process.platform === 'win32') {
    expect(exitCode ?? 0).toBe(0);
    return;
  }

  expect(exitCode).toBe(0);
}

describe('dist cli e2e', { timeout: 180_000 }, () => {
  let cliProcess: ReturnType<typeof startBuiltCli> | undefined;
  let configCleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stopCliProcess(cliProcess);
    await configCleanup?.();
  });

  it('runs built help and lists commands', async () => {
    const result = await runBuiltCli({
      args: ['--help'],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('serve');
    expect(result.stdout).toContain('cleanup');
    expect(result.stdout).toContain('export');
  });

  it('serves OIDC discovery from built artifacts', async () => {
    const { configPath, port, cleanup } = await createTestConfigFile();
    configCleanup = cleanup;

    cliProcess = startBuiltCli({
      args: ['serve', '--config-path', configPath],
      timeout: 60_000,
    });

    const res = await waitForReady(port);
    const body = await res.json();

    expect(body).toHaveProperty('issuer', `http://localhost:${port}`);
    expect(body).toHaveProperty('authorization_endpoint');
    expect(body).toHaveProperty('token_endpoint');

    cliProcess.kill('SIGINT');
    const result = await cliProcess;
    expectGracefulShutdownExitCode(result.exitCode);
  });
});
