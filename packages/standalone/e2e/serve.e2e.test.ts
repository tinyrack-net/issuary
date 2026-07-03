import { afterEach, describe, expect, it } from 'vitest';
import { createTestConfigFile } from './helpers/config-factory.ts';
import { runCli, startCli, stopCliProcess } from './helpers/spawn-cli.ts';
import { waitForReady } from './helpers/wait-for-ready.ts';

function expectGracefulShutdownExitCode(exitCode: number | undefined) {
  if (process.platform === 'win32') {
    expect(exitCode ?? 0).toBe(0);
    return;
  }

  expect(exitCode).toBe(0);
}

describe('serve e2e', { timeout: 180_000 }, () => {
  let cliProcess: ReturnType<typeof startCli> | undefined;
  let configCleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stopCliProcess(cliProcess);
    await configCleanup?.();
  });

  it('starts server and responds to OIDC discovery', async () => {
    const { configPath, port, cleanup } = await createTestConfigFile();
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 60_000,
    });

    const res = await waitForReady(port);
    const body = await res.json();

    expect(body).toHaveProperty('issuer');
    expect(body).toHaveProperty('authorization_endpoint');
    expect(body).toHaveProperty('token_endpoint');

    cliProcess.kill('SIGINT');
    const result = await cliProcess;
    expectGracefulShutdownExitCode(result.exitCode);
  });

  it('graceful shutdown on SIGTERM', async () => {
    const { configPath, port, cleanup } = await createTestConfigFile();
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 60_000,
    });

    await waitForReady(port);

    cliProcess.kill('SIGTERM');
    const result = await cliProcess;
    expectGracefulShutdownExitCode(result.exitCode);
  });

  it('exits 1 on invalid config path', async () => {
    const result = await runCli({
      args: ['serve', '-c', '/nonexistent.yaml'],
    });
    expect(result.exitCode).toBe(1);
  });

  it('exits 1 on invalid config content', async () => {
    const { configPath, cleanup } = await createTestConfigFile({
      security: {},
    });
    configCleanup = cleanup;

    const result = await runCli({
      args: ['serve', '-c', configPath],
    });
    expect(result.exitCode).toBe(1);
  });
});
