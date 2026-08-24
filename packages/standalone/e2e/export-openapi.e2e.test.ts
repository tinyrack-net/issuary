import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { removeDirectoryWithRetry } from './helpers/config-factory.ts';
import { runCli } from './helpers/spawn-cli.ts';

describe('export openapi e2e', { timeout: 90_000 }, () => {
  let tmpDir: string | undefined;

  afterEach(async () => {
    if (tmpDir) {
      await removeDirectoryWithRetry(tmpDir);
    }
  });

  it('outputs valid OpenAPI JSON to stdout', async () => {
    const result = await runCli({
      args: ['export', 'openapi'],
      timeout: 60_000,
    });

    expect(result.exitCode).toBe(0);

    const spec = JSON.parse(result.stdout);
    expect(spec).toHaveProperty('openapi');
    expect(spec).toHaveProperty('paths');
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  it('writes to file', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'issuary-openapi-'));
    const outputPath = path.join(tmpDir, 'openapi.json');

    const result = await runCli({
      args: ['export', 'openapi', outputPath],
      timeout: 60_000,
    });

    expect(result.exitCode).toBe(0);

    const content = await fs.readFile(outputPath, 'utf-8');
    const spec = JSON.parse(content);
    expect(spec).toHaveProperty('openapi');
    expect(spec).toHaveProperty('paths');
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });
});
