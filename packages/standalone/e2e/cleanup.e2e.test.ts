import { afterEach, describe, expect, it } from 'vitest';
import { createTestConfigFile } from './helpers/config-factory.ts';
import { runCli } from './helpers/spawn-cli.ts';

describe('cleanup e2e', { timeout: 20_000 }, () => {
  let configCleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await configCleanup?.();
  });

  it('runs cleanup and exits 0', async () => {
    const { configPath, cleanup } = await createTestConfigFile();
    configCleanup = cleanup;

    const result = await runCli({
      args: ['cleanup', '-c', configPath],
    });

    expect(result.exitCode).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain('Summary:');
  });

  it('dry run mode', async () => {
    const { configPath, cleanup } = await createTestConfigFile();
    configCleanup = cleanup;

    const result = await runCli({
      args: ['cleanup', '-c', configPath, '--dry-run'],
    });

    expect(result.exitCode).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain('[DRY RUN]');
  });

  it('verbose mode', async () => {
    const { configPath, cleanup } = await createTestConfigFile();
    configCleanup = cleanup;

    const result = await runCli({
      args: ['cleanup', '-c', configPath, '--verbose'],
    });

    expect(result.exitCode).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain('Duration:');
  });

  it('missing --config-path exits with non-zero code', async () => {
    const result = await runCli({
      args: ['cleanup'],
    });

    expect(result.exitCode).not.toBe(0);
  });
});
