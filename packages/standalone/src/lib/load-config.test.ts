// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Config fixtures intentionally use literal ${} syntax
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadConfig, loadResolvedConfig } from './load-config.js';

const originalEnv = { ...process.env };

async function writeConfigFile(
  dir: string,
  name: string,
  contents: string,
): Promise<string> {
  const filePath = path.join(dir, name);
  await fs.promises.writeFile(filePath, contents, 'utf-8');
  return filePath;
}

describe('load-config', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    process.env['COOKIE_SECRET'] =
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b';
    process.env['HASH_MASTER_SECRET'] =
      'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY';
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  test('loads config from the given configPath', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'config.yaml',
      [
        'app:',
        '  cookie_secret: explicit-secret-1234567890',
        'security:',
        '  hash_master_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const config = loadConfig({ configPath: configFile });

    expect(config.app.cookie_secret).toBe('explicit-secret-1234567890');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('throws when configPath file is missing', () => {
    expect(() => loadConfig({ configPath: '/missing/config.yaml' })).toThrow(
      'Config file not found',
    );
  });

  test('applies proxy frontend defaults during standalone resolution', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-proxy-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'proxy.yaml',
      [
        'app:',
        '  cookie_secret: proxy-secret-1234567890',
        '  frontend:',
        '    enabled: true',
        '    mode: proxy',
        'security:',
        '  hash_master_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const config = await loadResolvedConfig({ configPath: configFile });

    expect(config.app.frontend.path).toBe('http://localhost:8081');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('preserves disabled frontend without requiring path', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-disabled-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'disabled.yaml',
      [
        'app:',
        '  cookie_secret: disabled-secret-1234567890',
        '  frontend:',
        '    enabled: false',
        'security:',
        '  hash_master_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      ].join('\n'),
    );

    const config = await loadResolvedConfig({ configPath: configFile });

    expect(config.app.frontend.enabled).toBe(false);
    expect(config.app.frontend.path).toBe('');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('fails when security.hash_master_secret is missing', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-missing-security-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'missing-security.yaml',
      ['app:', '  cookie_secret: missing-security-secret-1234567890'].join(
        '\n',
      ),
    );

    await expect(
      loadResolvedConfig({ configPath: configFile }),
    ).rejects.toThrow('security');

    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('rejects removed security.hash_master_secret_version config', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-legacy-security-'),
    );
    const configFile = await writeConfigFile(
      dir,
      'legacy-security.yaml',
      [
        'app:',
        '  cookie_secret: legacy-security-secret-1234567890',
        'security:',
        '  hash_master_secret: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
        '  hash_master_secret_version: 1',
      ].join('\n'),
    );

    await expect(
      loadResolvedConfig({ configPath: configFile }),
    ).rejects.toThrow('hash_master_secret_version');

    await fs.promises.rm(dir, { recursive: true, force: true });
  });
});
