import { afterEach, describe, expect, it } from 'vitest';
import { createTestConfigFile } from './helpers/config-factory.js';
import { runCli, startCli } from './helpers/spawn-cli.js';
import { waitForReady } from './helpers/wait-for-ready.js';

describe('serve e2e', { timeout: 30_000 }, () => {
  let cliProcess: ReturnType<typeof startCli> | undefined;
  let configCleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cliProcess && !cliProcess.killed) {
      cliProcess.kill('SIGKILL');
      await cliProcess;
    }
    await configCleanup?.();
  });

  it('starts server and responds to OIDC discovery', async () => {
    const { configPath, port, cleanup } = await createTestConfigFile();
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 25_000,
    });

    const res = await waitForReady(port);
    const body = await res.json();

    expect(body).toHaveProperty('issuer');
    expect(body).toHaveProperty('authorization_endpoint');
    expect(body).toHaveProperty('token_endpoint');

    cliProcess.kill('SIGINT');
    const result = await cliProcess;
    expect(result.exitCode).toBe(0);
  });

  it('graceful shutdown on SIGTERM', async () => {
    const { configPath, port, cleanup } = await createTestConfigFile();
    configCleanup = cleanup;

    cliProcess = startCli({
      args: ['serve', '-c', configPath],
      timeout: 25_000,
    });

    await waitForReady(port);

    cliProcess.kill('SIGTERM');
    const result = await cliProcess;
    expect(result.exitCode).toBe(0);
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
