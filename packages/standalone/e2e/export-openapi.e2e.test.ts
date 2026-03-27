import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from './helpers/spawn-cli.ts';

describe('export openapi e2e', { timeout: 30_000 }, () => {
  let tmpDir: string | undefined;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('outputs valid OpenAPI JSON to stdout', async () => {
    const result = await runCli({
      args: ['export', 'openapi'],
      timeout: 25_000,
    });

    expect(result.exitCode).toBe(0);

    const spec = JSON.parse(result.stdout);
    expect(spec).toHaveProperty('openapi');
    expect(spec).toHaveProperty('paths');
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  it('writes to file', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tinyauth-openapi-'));
    const outputPath = path.join(tmpDir, 'openapi.json');

    const result = await runCli({
      args: ['export', 'openapi', outputPath],
      timeout: 25_000,
    });

    expect(result.exitCode).toBe(0);

    const content = await fs.readFile(outputPath, 'utf-8');
    const spec = JSON.parse(content);
    expect(spec).toHaveProperty('openapi');
    expect(spec).toHaveProperty('paths');
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });
});
