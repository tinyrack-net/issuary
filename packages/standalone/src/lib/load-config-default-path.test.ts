import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadConfig } from './load-config.js';

async function writeConfigFile(
  dir: string,
  name: string,
  contents: string,
): Promise<string> {
  const filePath = path.join(dir, name);
  await fs.promises.writeFile(filePath, contents, 'utf-8');
  return filePath;
}

describe('loadConfig default path fallback', () => {
  test('uses /opt/config.yaml when it exists', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-default-'),
    );
    const defaultFile = await writeConfigFile(
      dir,
      'default.yaml',
      'app:\n  cookie_secret: default-secret-1234567890\n',
    );

    const config = loadConfig({ defaultConfigPath: defaultFile });

    expect(config.app.cookie_secret).toBe('default-secret-1234567890');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });
});
