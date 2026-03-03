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
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  test('prefers the explicit configPath option', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-'),
    );
    const explicitFile = await writeConfigFile(
      dir,
      'explicit.yaml',
      'app:\n  cookie_secret: explicit-secret-1234567890\n',
    );
    const envFile = await writeConfigFile(
      dir,
      'env.yaml',
      'app:\n  cookie_secret: env-secret-1234567890\n',
    );
    process.env['CONFIG_PATH'] = envFile;

    const config = loadConfig({ configPath: explicitFile });

    expect(config.app.cookie_secret).toBe('explicit-secret-1234567890');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('uses CONFIG_PATH when no explicit configPath is provided', async () => {
    const dir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-load-config-env-'),
    );
    const envFile = await writeConfigFile(
      dir,
      'env.yaml',
      'app:\n  cookie_secret: env-secret-1234567890\n',
    );
    process.env['CONFIG_PATH'] = envFile;

    const config = loadConfig();

    expect(config.app.cookie_secret).toBe('env-secret-1234567890');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('falls back to environment defaults when no config file exists', () => {
    const config = loadConfig();

    expect(config.app.cookie_secret).toBe(process.env['COOKIE_SECRET']);
    expect(config.app.frontend.mode).toBe('static');
    expect(config.app.frontend.path).toBe('/opt/tinyauth/frontend');
  });

  test('throws when an explicit configPath is missing', () => {
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
      ].join('\n'),
    );

    const config = await loadResolvedConfig({ configPath: configFile });

    expect(config.app.frontend.enabled).toBe(false);
    expect(config.app.frontend.path).toBe('');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('returns raw config with standalone frontend defaults applied', () => {
    const config = loadConfig();

    expect(config.app.frontend.path).toBe('/opt/tinyauth/frontend');
  });
});
