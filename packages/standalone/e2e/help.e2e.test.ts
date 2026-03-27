import { describe, expect, it } from 'vitest';
import { runCli } from './helpers/spawn-cli.ts';

describe('root help e2e', { timeout: 20_000 }, () => {
  it('lists supported commands without autocomplete', async () => {
    const result = await runCli({
      args: ['--help'],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('serve');
    expect(result.stdout).toContain('cleanup');
    expect(result.stdout).toContain('export');
    expect(result.stdout).not.toContain('autocomplete');
  });
});
